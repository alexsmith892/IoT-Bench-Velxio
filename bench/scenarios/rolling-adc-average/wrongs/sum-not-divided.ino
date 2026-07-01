// WRONG (rolling_adc_average): prints the SUM of the eight samples instead of the
// mean (forgets the divide-by-8), so the reported value is ~8x too large. Fails
// the decoded-value contract. expectFailCategory: serial-value.

const int SENSOR_PIN = A0;
const unsigned long PERIOD_MS = 25;
const int WINDOW = 8;

int samples[WINDOW];
int idx = 0;
int filled = 0;
unsigned long tNext = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  unsigned long now = millis();
  if ((long)(now - tNext) < 0) return;
  tNext = now + PERIOD_MS;

  samples[idx] = analogRead(SENSOR_PIN);
  idx = (idx + 1) % WINDOW;
  if (filled < WINDOW) filled++;

  if (filled == WINDOW) {
    long sum = 0;
    for (int i = 0; i < WINDOW; i++) sum += samples[i];
    Serial.print("AVG=");
    Serial.println(sum); // BUG: no divide by WINDOW
  }
}
