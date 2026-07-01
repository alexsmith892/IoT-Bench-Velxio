// rolling_adc_average (OS-D2-04) — reference solution.
// A0 sampled every 25 ms. Once eight samples exist, after each new sample print
// the truncated integer mean of the most recent eight as "AVG=<n>". Print nothing
// before the eighth sample.

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
    long avg = sum / WINDOW;            // truncated toward zero (readings >= 0)
    Serial.print("AVG=");
    Serial.println(avg);
  }
}
