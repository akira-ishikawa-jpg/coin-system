// エラーハンドリングユーティリティ

export type ErrorType = 'network' | 'auth' | 'validation' | 'server' | 'unknown'

export interface AppError {
  type: ErrorType
  message: string
  userMessage: string
  retryable: boolean
}

export function handleError(error: any): AppError {
  // ネットワークエラー
  if (error.message === 'Failed to fetch' || error.name === 'NetworkError') {
    return {
      type: 'network',
      message: error.message,
      userMessage: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
      retryable: true
    }
  }

  // 認証エラー
  if (error.status === 401 || error.message?.includes('Unauthorized')) {
    return {
      type: 'auth',
      message: error.message,
      userMessage: 'セッションが切れました。再度ログインしてください。',
      retryable: false
    }
  }

  // バリデーションエラー
  if (error.status === 400) {
    return {
      type: 'validation',
      message: error.message,
      userMessage: error.error || error.message || '入力内容に誤りがあります。',
      retryable: false
    }
  }

  // サーバーエラー
  if (error.status >= 500) {
    return {
      type: 'server',
      message: error.message,
      userMessage: 'サーバーエラーが発生しました。時間をおいて再度お試しください。',
      retryable: true
    }
  }

  // その他のエラー
  return {
    type: 'unknown',
    message: error.message || String(error),
    userMessage: '予期しないエラーが発生しました。',
    retryable: true
  }
}

// リトライ機能付きfetch
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  delay: number = 1000
): Promise<Response> {
  let lastError: any

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      
      // 成功またはリトライ不要なエラー
      if (response.ok || response.status === 400 || response.status === 401 || response.status === 403) {
        return response
      }

      // サーバーエラーの場合はリトライ
      if (response.status >= 500 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
        continue
      }

      return response
    } catch (error) {
      lastError = error
      
      // 最後のリトライでなければ待機
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
      }
    }
  }

  throw lastError
}

// タイムアウト付きfetch
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('リクエストがタイムアウトしました')
    }
    throw error
  }
}
