/**@link {@see https://refactoring.guru/design-patterns/observer/typescript/example#example-0--index-ts} */

/**
 * @description set of methods to manage SUBSCRIBERS
 * Subject is the object we want other object to subscribe to
 */
interface Subject {
  attach(observer: Observer): void;
  detach(observer: Observer): void;
  notify(): void;
}

class ConcreteSubject implements Subject {
  /**@description the state of the subject */
  public state: number = 0;
  private observers: Observer[] = [];

  public attach(observer: Observer): void {
    const isExist = this.observers.includes(observer);
    if (isExist)
      return console.log("Subject: Observer has already been attached");
    console.log("Subject: Attached an observer");
    this.observers.push(observer);
  }

  public detach(observer: Observer): void {
    const observerIndex = this.observers.indexOf(observer);
    if (observerIndex === -1)
      return console.log("Subject: Non Existent observer");
    // go to the index, remove one, return the removed element array
    this.observers.splice(observerIndex, 1);
    console.log("Subject: Detached an observer");
  }

  /**@qn shouldn't this be private because we only want to notify subscriber when some other business logic occurs */
  public notify(): void {
    console.log("Subject: Notifying observers...");
    for (const observer of this.observers) {
      observer.update(this);
    }
  }

  public someBusinessLogic(): void {
    console.log("Subject: Im doing something important.");
    this.state = Math.floor(Math.random() * (10 + 1));
    console.log(`Subject: My state has just changed to: ${this.state}`);
    this.notify();
  }
}


interface Observer {
  /**
   * @description handler which will react to the state change from the Subject.
   * This will be called by the Subject when its performing a `notify`.
   * AH to `notify` the observers, each observer needs to have their own `update` function which will then allow the publisher
   * to call it to `notify` the observers
   */
  update(subject: Subject): void
}

class ConcreteObserverA implements Observer {
  public update(subject: Subject): void {
    if (subject instanceof ConcreteSubject && subject.state < 3) {
      console.log('ConcreteObserverA: Reacted to event')
    }
  }
}

class ConcreteObserverB implements Observer {
  public update(subject: Subject): void {
    if (subject instanceof ConcreteSubject && (subject.state === 0 || subject.state >= 2)) {
      console.log('ConcreteObserverB: Reacted to event')
    }
  }
}

const subject = new ConcreteSubject()

const observer1 = new ConcreteObserverA()
subject.attach(observer1)

const observer2 = new ConcreteObserverB()
subject.attach(observer2)

subject.someBusinessLogic()
subject.someBusinessLogic()

subject.detach(observer2)

subject.someBusinessLogic()
