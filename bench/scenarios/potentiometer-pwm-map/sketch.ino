// potentiometer_pwm_map (OS-D1-04) — reference solution.
// Pot on A1 → PWM LED on D3. Linearly map ADC 0..1023 to duty 0..255, clamped,
// refreshed at least every 20 ms.

const int POT_PIN = A1;
const int LED_PIN = 3;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int raw = analogRead(POT_PIN);
  int duty = map(raw, 0, 1023, 0, 255);
  duty = constrain(duty, 0, 255);
  analogWrite(LED_PIN, duty);
  delay(10);
}
