// WRONG (potentiometer_pwm_map): hardcoded half-brightness, ignoring the pot.
// Passes near mid-scale by luck but fails both endpoints and any changing input.
// expectFailCategory: pwm-duty.

const int LED_PIN = 3;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  analogWrite(LED_PIN, 128); // wrong: fixed duty regardless of A1
  delay(10);
}
