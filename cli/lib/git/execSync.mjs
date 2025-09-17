import {execSync, spawn, spawnSync} from 'node:child_process';
import path from "node:path";
import fs from "node:fs";
import FormData from 'form-data';
import axios from "axios";
import ignore from 'ignore';
import chalk from 'chalk';

import {getResponse} from "../util/interaction.mjs";
import {isUsableRepoName, mkRepo} from "../api/api.mjs";
import {mkDiFFdirectory} from "../DiFF/init.mjs";
import {getRepositoryId} from "../DiFF/draft.mjs";
const BASE_URL = "https://api.diff.io.kr/api/DiFF";
let repoId = 0;

/** git repository 여부 **/
export async function existsGitDirectory(){

    return execSync('[ -d .git ] && echo true || echo false').toString().trim();
}

/** .DiFF 디렉토리 존재 여부 **/
export async function existsDiFF() {
    return execSync('[ -d .DiFF ] && echo true || echo false').toString().trim();
}

/** 브랜치 존재 여부 **/
export async function branchExists(branch) {
    const checkBranch =
        execSync(`git show-ref --verify --quiet refs/heads/${branch} && echo "true" || echo "false"`).toString().trim();
    return checkBranch === "true";
}

/** 요청 브랜치 마지막 체크섬 **/
export async function getLastChecksum(branch) {
    return execSync(`git rev-parse ${branch}`).toString().trim();
}

/** .DiFF 디렉토리 만들기 **/
export async function DiFFinit(memberId, branch) {

    const q = await getResponse();
    console.log(' Your repository isn\'t connected.');

    // repository 이름 입력, 중복 확인
    let repoName = await q.ask(' Please enter your new DiFF repository name: ');
    let usable = await isUsableRepoName(memberId, repoName);
    while(!usable){
        repoName = await q.ask(' This repository name is already in use. Try a different one: ');
        usable = await isUsableRepoName(memberId, repoName);
    }

    // 첫 커밋 가져오기
    let firstCommit = execSync(`git log --reverse ${branch} --oneline | head -n 1`)
        .toString().trim();

    const firstChecksum = firstCommit.split(' ')[0];

    // 서버에 리포지토리 DB 데이터 생성 요청
    repoId = await mkRepo(memberId, repoName, firstChecksum);
    if(repoId === null){
        console.log(chalk.red("Server error. Please try again later."));
        return null;
    }

    // .DiFF 생성
    await mkDiFFdirectory(repoId);

    q.close();
    return firstChecksum;
}

/** 코드 분석 **/
// doAnalysis.js
export async function doAnalysis(branch, memberId, draftId, diffId) {
    try {
        const lastChecksum = await getLastChecksum(branch);
        const repositoryId = await getRepositoryId(branch);

        // target 폴더 존재 여부 확인
        const hasTarget = await new Promise((resolve, reject) => {
            const p = spawn('[ -d target ] && echo true || echo false', { shell: true });
            let out = '';
            let err = '';
            p.stdout.on('data', d => out += d.toString());
            p.stderr.on('data', d => err += d.toString());
            p.on('close', code => {
                if (code === 0) {
                    resolve(out.trim() === 'true');
                } else {
                    reject(new Error(`target check failed: ${err}`));
                }
            });
            p.on('error', err => reject(new Error(`spawn error: ${err.message}`)));
        });

        // 압축 준비
        if (hasTarget) {
            await sh(`git archive --format=zip --output=withoutTarget.zip ${branch}`);
            await sh(`rm -rf tempdir difftest.zip`);
            await sh(`mkdir tempdir`);
            await sh(`unzip withoutTarget.zip -d tempdir`);
            await sh(`cp -r target tempdir/`);
            await sh(`cd tempdir && zip -r ../difftest.zip .`);
            await sh(`rm withoutTarget.zip && rm -rf tempdir`);
        } else {
            await sh(`git archive --format=zip --output=difftest.zip ${branch}`);
        }

        if (!fs.existsSync('difftest.zip')) {
            throw new Error('difftest.zip is not exist.');
        }

        // FormData 생성 및 전송
        const form = new FormData();
        form.append('file', fs.createReadStream('difftest.zip'));
        form.append('meta', JSON.stringify({
            memberId,
            repositoryId,
            draftId,
            diffId,
            lastChecksum,
        }));

        await axios.post(`${BASE_URL.replace(/\/api\/DiFF$/, "")}/upload`, form, {
            headers: form.getHeaders(),
        });


        fs.unlinkSync('difftest.zip');
        return true;
    } catch (err) {
        console.error(chalk.red(`Analysis failed: ${err.message}`));
        console.error(err.stack);
        return false;
    }
}

// 비동기로 cmd
export async function sh(cmd, passthrough = false) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, {
            stdio: passthrough ? 'inherit' : 'pipe',
            shell: true,
        });

        let out = '';
        let err = '';

        if (!passthrough) {
            p.stdout.on('data', d => out += d.toString());
            p.stderr.on('data', d => err += d.toString());
        }

        p.on('close', code => {
            if (code === 0) resolve(out.trim());
            else reject(new Error(`command failed: ${cmd}\n${err}`));
        });
    });
}

function getGitIgnoreFilter() {
    const ig = ignore();
    const ignorePath = path.join(process.cwd(), '.gitignore');

    if (fs.existsSync(ignorePath)) {
        const content = fs.readFileSync(ignorePath, 'utf-8');
        ig.add(content.split('\n'));
    }

    return ig;
}

export function getDiFF(from, to) {

    return new Promise((resolve, reject) => {
        const extensions = ['.mjs', '.jsx', '.java', '.ts', '.tsx', '.jsp', '.js',
            '.py', '.c', '.cs', '.cpp', '.php', '.go', '.rs', '.rb', '.kt', '.swift', '.xml'];

        const gitignoreFilter = getGitIgnoreFilter();

        // 변경된 파일 목록 추출
        const diffNameResult = spawnSync('git', ['diff', '--name-only', from, to], {
            encoding: 'utf-8'
        });

        if (diffNameResult.status !== 0) {
            return reject(new Error(`Failed to get diff file list: ${diffNameResult.stderr}`));
        }

        let files = diffNameResult.stdout.trim().split('\n').filter(f => !!f);

        files = files.filter(file => extensions.some(ext => file.endsWith(ext)));

        files = gitignoreFilter.filter(files);

        if (files.length === 0) {
            console.log(chalk.red('No matching files to DiFF.'));
            return resolve('');
        }

        const args = ['diff', '-W', from, to, '--', ...files];
        const child = spawn('git', args, { shell: false });

        let output = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            // console.error(chalk.red('stderr:'), data.toString());
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`err: ${code}`));
            }
        });
    });
}