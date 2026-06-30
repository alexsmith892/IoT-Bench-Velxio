// WRONG (potentiometer_pwm_map): treats the output as on/off around mid-scale
// instead of a proportional PWM duty. Fails the mid-scale variant where an
// intermediate reading must produce an intermediate duty. expectFailCategory:
// pwm-duty.

const int POT_PIN = A1;
const int LED_PIN = 3;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int raw = analogRead(POT_PIN);
  digitalWrite(LED_PIN, raw >= 512 ? HIGH : LOW); // wrong: threshold, not map
  delay(10);
}
