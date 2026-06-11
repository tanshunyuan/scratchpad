interface EventManager {
  subscribe(eventType: string, listener: NotDOMEventListener): void;
  unsubscribe(eventType: string, listener: NotDOMEventListener): void;
  notify(eventType: string, data: any): void;
}

// {
//   eventType: Listener[]
// }
class ConcreteEventManager implements EventManager {
  private listeners: Record<string, NotDOMEventListener[]> = {};

  subscribe(eventType: string, listener: NotDOMEventListener): void {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = []
    }
    const isExists = this.listeners[eventType].includes(listener);
    if (isExists) return console.log("already attached");
    this.listeners[eventType].push(listener);
    console.log('attached a listener')
  }
  unsubscribe(eventType: string, listener: NotDOMEventListener): void {
    const idx = this.listeners[eventType] && this.listeners[eventType].indexOf(listener);
    if (idx === -1) return console.log("not found cannot unsub");

    this.listeners[eventType].splice(idx, 1);
    console.log("detached");
  }

  notify(eventType: string, data: any): void {
    for (const listener of this.listeners[eventType]) {
      listener.handle(data);
    }
  }
}

class Editor {
  public events: EventManager;

  constructor() {
    this.events = new ConcreteEventManager();
  }

  public openFile(path: string) {
    this.events.notify("open", path);
  }

  public saveFile(path: string) {
    this.events.notify("save", path);
  }
}

interface NotDOMEventListener {
  handle(data: any): void;
}

class EmailAlertsListener implements NotDOMEventListener {
  private email: string;
  private message: string;

  constructor(email: string, message: string) {
    this.email = email;
    this.message = message;
  }

  handle(data: any): void {
    const formattedMessage = this.message.replace("%s", data);

    console.log(`Sending email to ${this.email}`);
    console.log(formattedMessage);
  }

  // update(eventManager: EventManager): void {
  //   // perform side effect
  //   // system.email(email, replace('%s', filename, message))
  // }
}

const editor = new Editor();

const emailAlerts = new EmailAlertsListener(
  "admin@example.com",
  "someone has changed the file: %s",
);
// need to subscribe first, before we can emit
editor.events.subscribe("save", emailAlerts);
editor.events.subscribe('open', emailAlerts)

editor.saveFile('path')
