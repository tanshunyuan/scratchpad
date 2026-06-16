// Observer Pattern Exercise: Weather Station
//
// Goal: A WeatherStation (Subject) holds the latest weather readings.
// Several displays (Observers) subscribe to it and react whenever
// new measurements come in.

// ---------- Shared data shape ----------

interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
}

// ---------- Observer interface ----------
// Anything that wants to be notified of weather changes implements this.

interface Observer {
  update(data: WeatherData): void;
}

// ---------- Subject interface ----------
// Anything that can be observed implements this.

interface Subject {
  subscribe(observer: Observer): void;
  unsubscribe(observer: Observer): void;
  notify(): void;
}

// ---------- Concrete Subject ----------

class WeatherStation implements Subject {
  private observers: Observer[] = [];
  private data: WeatherData = { temperature: 0, humidity: 0, pressure: 0 };

  subscribe(observer: Observer): void {
    // TODO: add `observer` to this.observers
    const isExists = this.observers.includes(observer)
    if (isExists) {
      console.log('not adding this observer, it already exists')
      return
    }
    this.observers.push(observer)
  }

  unsubscribe(observer: Observer): void {
    // TODO: remove `observer` from this.observers
    // (hint: Array.prototype.filter is handy here)
    this.observers = this.observers.filter(internalObserver => internalObserver !== observer)
  }

  notify(): void {
    // TODO: loop over this.observers and call update(this.data) on each one
    for (const observer of this.observers) {
      observer.update(this.data)
    }
  }

  setMeasurements(temperature: number, humidity: number, pressure: number): void {
    this.data = { temperature, humidity, pressure };
    // TODO: call notify() so subscribed observers find out about the change
    this.notify()
  }
}

// ---------- Concrete Observers ----------

class CurrentConditionsDisplay implements Observer {
  update(data: WeatherData): void {
    // TODO: log something like:
    // "Current conditions: 80°F and 65% humidity"
    console.log(`Current conditions ${data.temperature} degrees, ${data.humidity}% humidity and ${data.pressure} bars of psi`)
  }
}

class StatisticsDisplay implements Observer {
  private temperatures: number[] = [];

  update(data: WeatherData): void {
    this.temperatures.push(data.temperature)
    console.log('le temperatures ==> ', this.temperatures)
    // TODO:
    // 1. push data.temperature into this.temperatures
    // 2. compute min, max, and average of all temperatures seen so far
    // 3. log something like:
    //    "Statistics: avg/max/min temperature = 81.0/82.0/80.0"
  }
}

class ForecastDisplay implements Observer {
  private lastPressure: number | null = null;

  update(data: WeatherData): void {
    if (this.lastPressure === null) {
      this.lastPressure = data.pressure
      return
    } else if (data.pressure > this.lastPressure) {
      console.log("Forcast: Improving weather on the way!")
    } else if (data.pressure < this.lastPressure) {
      console.log("Forecast: Watch out for cooler, rainy weather")
    } else if (data.pressure === this.lastPressure) {
      console.log("Forecast: More of the same")
    }

    this.lastPressure = data.pressure
    // TODO:
    // - if this.lastPressure is null, just store data.pressure and return
    // - if data.pressure > this.lastPressure -> log "Forecast: Improving weather on the way!"
    // - if data.pressure < this.lastPressure -> log "Forecast: Watch out for cooler, rainy weather"
    // - if equal -> log "Forecast: More of the same"
    // - finally, update this.lastPressure to data.pressure
  }
}

// ---------- Client code ----------
// Once the TODOs above are filled in, this should run without changes
// and print sensible output for each update.

const weatherStation = new WeatherStation();

const currentDisplay = new CurrentConditionsDisplay();
const statisticsDisplay = new StatisticsDisplay();
const forecastDisplay = new ForecastDisplay();

weatherStation.subscribe(currentDisplay);
weatherStation.subscribe(statisticsDisplay);
weatherStation.subscribe(forecastDisplay);

console.log("--- First update ---");
weatherStation.setMeasurements(80, 65, 30.4);

console.log("\n--- Second update ---");
weatherStation.setMeasurements(82, 70, 29.2);

console.log("\n--- Unsubscribing the forecast display ---");
weatherStation.unsubscribe(forecastDisplay);

console.log("\n--- Third update (forecast display should NOT react) ---");
weatherStation.setMeasurements(78, 90, 29.2);

// ---------- Stretch goals (optional) ----------
// Once the basics work, try one or more of these to deepen your understanding:
//
// 1. Add a HeatIndexDisplay observer that calculates and logs a simple
//    "feels like" temperature based on temperature + humidity.
//
// 2. Switch from "push" to "pull": instead of passing the full WeatherData
//    object in update(), pass a reference to the WeatherStation itself and
//    have observers call getter methods to pull only the data they need.
//
// 3. Make subscribe() prevent the same observer from being added twice.
//
// 4. Add a generic EventEmitter-style Subject that can notify on named
//    events (e.g. "temperatureChanged", "pressureChanged") rather than
//    one big update() for everything.
