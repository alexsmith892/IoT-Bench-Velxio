// WRONG (tmp36_calibrated_report): forgets the 0.500 V TMP36 offset, so every
// reading is off by 50 °C. Format is correct, the value is not — fails the
// serial-value semantic assertion. expectFailCategory: serial-value.

const int SENSOR_PIN = A0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int raw = analogRead(SENSOR_PIN);
  float volts = raw * (5.0 / 1023.0);
  float tempC = volts / 0.01; // wrong: omits the - 0.5 offset
  Serial.print("TEMP_C=");
  Serial.println(tempC, 1);
  delay(250);
}
