export type AiCode = 'not-configured' | 'quota' | 'network' | 'auth' | 'server';
export class AiError extends Error { constructor(msg: string, public code: AiCode) { super(msg); } }
