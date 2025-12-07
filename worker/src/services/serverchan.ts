export interface ServerChanResponse {
  code: number;
  message: string;
  data: {
    pushid?: string;
    readkey?: string;
    error?: string;
    errno?: number;
  };
}

export async function sendServerChanMessage(
  token: string,
  title: string,
  content: string,
): Promise<ServerChanResponse> {
  try {
    const baseUrl = `https://sctapi.ftqq.com/${token}.send`;

    const params = new URLSearchParams();
    params.append('title', title);
    params.append('desp', content);

    const postResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const postResult = (await postResponse.json()) as ServerChanResponse;
    if (postResult.code === 0) return postResult;

    const getUrl = `${baseUrl}?${params.toString()}`;
    const getResponse = await fetch(getUrl, { method: 'GET' });
    const getResult = (await getResponse.json()) as ServerChanResponse;
    if (getResult.code === 0) return getResult;

    const legacyParams = new URLSearchParams();
    legacyParams.append('text', title);
    legacyParams.append('desp', content);
    const legacyUrl = `https://sc.ftqq.com/${token}.send?${legacyParams.toString()}`;
    const legacyResponse = await fetch(legacyUrl, { method: 'GET' });
    const legacyResult = (await legacyResponse.json()) as ServerChanResponse;
    return legacyResult;
  } catch (error) {
    return { code: -1, message: String(error), data: { error: 'FETCH_ERROR', errno: -1 } };
  }
}
