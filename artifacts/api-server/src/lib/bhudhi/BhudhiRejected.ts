export type BhudhiRejectReason = "UNREGISTERED_TRIGGER" | "SOURCE_NOT_ALLOWED";

export class BhudhiRejected extends Error {
  readonly reason: BhudhiRejectReason;

  constructor(reason: BhudhiRejectReason) {
    super(reason);
    this.name = "BhudhiRejected";
    this.reason = reason;
  }
}
