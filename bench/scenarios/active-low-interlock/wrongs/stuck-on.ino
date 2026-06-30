// WRONG (active_low_interlock): hardcoded — drives the LED permanently ON
// (LOW) and never reads the button. Fails the pin-state contract on every
// released window (and at startup). expectFailCategory: pin-state.

const int LED_PIN = 7;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // active-low: stuck ON
}

void loop() {
  digitalWrite(LED_PIN, LOW);
}
