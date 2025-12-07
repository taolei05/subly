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
): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      title: title,
      desp: content,
    });

    const url = `https://sctapi.ftqq.com/${token}.send?${params.toString()}`;

    const response = await fetch(url, {
      method: 'POST', // Server酱其实支持 GET 和 POST
    });

    const result = (await response.json()) as ServerChanResponse;

    if (result.code === 0) {
      return true;
    } else {
      console.error('ServerChan error:', result);
      return false;
    }
  } catch (error) {
    console.error('ServerChan fetch error:', error);
    return false;
  }
}
