// WRONG (rolling_adc_average): ignores the ADC and prints a fixed AVG. Passes a
// stimulus that happens to sit near 512, but fails as soon as the injected input
// changes. expectFailCategory: serial-value.

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.println("AVG=512");
  delay(25);
}
