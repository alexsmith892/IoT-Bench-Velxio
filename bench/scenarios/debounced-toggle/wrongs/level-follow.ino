// WRONG (debounced_toggle): the LED simply FOLLOWS the button level (on while
// pressed, off while released) instead of toggling once per press. It never
// latches, so after a release the LED wrongly turns back off. Fails the pin-state
// contract wherever the LED must stay latched after release. expectFailCategory:
// pin-state.

const int BTN_PIN = 2;
const int LED_PIN = 7;

void setup() {
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // off
}

void loop() {
  bool pressed = digitalRead(BTN_PIN) == LOW;
  digitalWrite(LED_PIN, pressed ? LOW : HIGH); // active-low mirror, no latch
}
