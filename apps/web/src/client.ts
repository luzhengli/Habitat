let csrf: string | null = null;
let session: Promise<void> | null = null;
export async function request<T>(route: string, method = 'GET', body?: unknown, retried = false): Promise<T> {
  if (!csrf) {
    session ??= (async () => {
      const response = await fetch('/api/v1/session', { credentials: 'same-origin', headers: { 'X-Habitat-Client': 'habitat-web' } });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error?.message ?? '本地会话建立失败');
      csrf = value.csrfToken;
    })().finally(() => { session = null; });
    await session;
  }
  let response: Response;
  try { response = await fetch(`/api/v1/${route}`, { method, credentials: 'same-origin', headers: { 'X-Habitat-Client': 'habitat-web', 'X-Habitat-CSRF': csrf ?? '', ...(body === undefined ? {} : {'Content-Type':'application/json'}) }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new Error('本地服务已断开。请启动服务后重试；显示的旧索引不代表当前状态。'); }
  const value = await response.json();
  if (!response.ok) { if (response.status === 401 || value.error?.code === 'CSRF_REJECTED') {csrf = null;if(method === 'GET' && !retried)return request<T>(route,method,body,true);} throw new Error(value.error?.message ?? '请求失败'); }
  return value;
}
