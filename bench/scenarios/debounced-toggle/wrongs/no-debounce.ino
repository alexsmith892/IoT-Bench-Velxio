// WRONG (debounced_toggle): toggles on EVERY raw falling edge with no debounce.
// Contact bounce (multiple 1->0 edges within a few ms) causes extra toggles, so a
// bounced press lands the LED in the wrong state. Fails the pin-state contract on
// the bounce-rejected variant. expectFailCategory: pin-state.

const int BTN_PIN = 2;
const int LED_PIN = 7;

int ledState = HIGH;    // active-low: off
int lastReading = HIGH;

void setup() {
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, ledState);
}

void loop() {
  int reading = digitalRead(BTN_PIN);
  if (lastReading == HIGH && reading == LOW) {   // raw falling edge, no debounce
    ledState = (ledState == HIGH) ? LOW : HIGH;
    digitalWrite(LED_PIN, ledState);
  }
  lastReading = reading;
}
