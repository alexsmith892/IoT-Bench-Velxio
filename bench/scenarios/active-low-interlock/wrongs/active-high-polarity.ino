// WRONG (active_low_interlock): treats the LED as active-HIGH, inverting the
// drive. Pressed → HIGH (LED off), released → LOW (LED on). Fails the pin-state
// contract on every window. expectFailCategory: pin-state.

const int BUTTON_PIN = 2;
const int LED_PIN = 7;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // wrong: drives the active-low LED ON at startup
}

void loop() {
  bool pressed = digitalRead(BUTTON_PIN) == LOW;
  digitalWrite(LED_PIN, pressed ? HIGH : LOW); // inverted
}
