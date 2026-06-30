// WRONG (tmp36_calibrated_report): hardcodes the example reading and never reads
// the sensor. Passes the room-temperature variant by luck but fails every variant
// whose injected voltage maps to a different temperature. expectFailCategory:
// serial-value (the semantic half of the value/format split).

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.println("TEMP_C=23.4");
  delay(250);
}
