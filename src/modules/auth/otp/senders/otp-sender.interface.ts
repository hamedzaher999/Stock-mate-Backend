export interface OtpSenderResult {
  success: boolean;
  providerMessageId?: string;
}

export interface OtpSender {
  send(destination: string, code: string): Promise<OtpSenderResult>;
}
