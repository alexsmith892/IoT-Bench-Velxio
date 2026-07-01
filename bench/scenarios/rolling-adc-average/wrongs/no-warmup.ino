// WRONG (rolling_adc_average): starts printing immediately instead of waiting for
// eight samples to exist — it averages however many it has so far. With a steady
// input the reported value is right, but it emits AVG lines before the eighth
// sample. Fails the "print nothing before the eighth sample" check.
// expectFailCategory: serial-format.

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

  // BUG: prints from the very first sample instead of waiting for eight.
  long sum = 0;
  for (int i = 0; i < filled; i++) sum += samples[(idx - 1 - i + WINDOW) % WINDOW];
  long avg = sum / filled;
  Serial.print("AVG=");
  Serial.println(avg);
}
