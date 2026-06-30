// Adversarial wrong: drives the LED constantly HIGH (never blinks).
// Designed to FAIL the frequency contract via the minPeriods stuck-pin guard.

constexpr int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
}

void loop() {
}
