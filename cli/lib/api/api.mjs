import axios from "axios";
import dotenv from "dotenv";
import { getGitEmail } from "../git/simpleGit.mjs";
import chalk from "chalk";

dotenv.config();

const BASE_URL = "https://api.diff.io.kr/api/DiFF"

/** diff member check **/
export async function verifyGitUser() {
    const email = await getGitEmail();

    if (email === null) {
        return null;
    }

    try {
        const { data } = await axios.post(`${BASE_URL}/draft/verifyGitUser`, {
            email,
        });

        return data.resultCode.startsWith("S-") ? data.data1 : null;
    } catch (err) {
        return null;
    }
}

/** repository name check **/
export async function isUsableRepoName(memberId, repoName) {
    const { data } = await axios.post(`${BASE_URL}/draft/isUsableRepoName`, {
        memberId,
        repoName,
    });
    return data.data1;
}

/** insert repository DB **/
export async function mkRepo(memberId, repoName, commitHash) {
    const { data } = await axios.post(`${BASE_URL}/draft/mkRepo`, {
        memberId,
        repoName,
        firstCommit: commitHash,
    });

    if (data.resultCode.startsWith("S-")) {
        return data.data1;
    } else {
        console.log("This repository name is already in use.");
        return null;
    }
}

/** send diff **/
export async function sendDiFF(
    memberId,
    repositoryId,
    draftId,
    diffId,
    checksum,
    diff
) {
    try {
        const { data } = await axios.post(`${BASE_URL}/draft/receiveDiff`, {
            memberId,
            repositoryId,
            draftId,
            diffId,
            lastChecksum: checksum,
            diff,
        });

        return data.resultCode?.startsWith("S-") ? true : false;
    } catch (error) {
        return false;
    }
}
