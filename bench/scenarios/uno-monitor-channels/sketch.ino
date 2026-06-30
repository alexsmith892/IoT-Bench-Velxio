constexpr int POT_PIN = A1;
constexpr int PWM_PIN = 3;

unsigned long lastReportMs = 0;

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  const unsigned long now = millis();
  if (now - lastReportMs < 100) return;
  lastReportMs = now;

  const int adc = analogRead(POT_PIN);
  const int duty = map(adc, 0, 1023, 0, 255);
  analogWrite(PWM_PIN, duty);
  Serial.print("ADC=");
  Serial.print(adc);
  Serial.print(" PWM=");
  Serial.println(duty);
}
