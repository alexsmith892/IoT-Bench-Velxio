// tmp36_calibrated_report (OS-D1-03) — reference solution.
// TMP36 on A0: ADC ref 5.0 V, 0..1023; 0.500 V at 0 °C, 0.010 V/°C.
// Print TEMP_C=x.x (one decimal) every 250 ms at 115200 baud; first line < 300 ms.

const int SENSOR_PIN = A0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int raw = analogRead(SENSOR_PIN);
  float volts = raw * (5.0 / 1023.0);
  float tempC = (volts - 0.5) / 0.01;
  Serial.print("TEMP_C=");
  Serial.println(tempC, 1);
  delay(250);
}
