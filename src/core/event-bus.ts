type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  on<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as EventHandler);
    this.handlers.set(event, list);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const idx = list.indexOf(handler as EventHandler);
    if (idx >= 0) list.splice(idx, 1);
  }

  emit<T>(event: string, payload: T): void {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const h of list) h(payload);
  }
}
