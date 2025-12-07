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
    const url = `https://sctapi.ftqq.com/${token}.send`;
    
    // 使用 x-www-form-urlencoded 格式
    const params = new URLSearchParams();
    params.append('title', title);
    params.append('desp', content);

    console.log(`Sending ServerChan message to ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const result = (await response.json()) as ServerChanResponse;
    console.log('ServerChan response:', result);

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
