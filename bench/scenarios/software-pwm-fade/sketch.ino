// software_pwm_fade (OS-D3-09) — reference solution.
// Generate a 200 Hz (5 ms period) software PWM on D8 (a non-PWM pin) by hand —
// no analogWrite / timer PWM / Servo. Duty is 0..255: 0 holds LOW, 255 holds HIGH,
// intermediate drives HIGH for that fraction of each period. Serial @115200:
// "DUTY n" sets duty immediately (OK DUTY=n); "RAMP n ms" moves the duty linearly
// from the current value to n over ms milliseconds then holds (OK RAMP=n);
// malformed / out-of-range → ERR. The carrier keeps running while a ramp is active.

const int PWM_PIN = 8;
const unsigned long PERIOD_US = 5000;   // 200 Hz

int duty = 0;                 // current duty 0..255
unsigned long periodStart = 0;
bool pinHigh = false;

bool ramping = false;
float rampFrom = 0, rampTo = 0;
unsigned long rampStartMs = 0, rampDurMs = 0, lastRampMs = 0;

char line[24];
int len = 0;
bool overlong = false;

// Parse an unsigned decimal within [0, hi]; -1 on any non-digit/overflow/empty.
long parseNum(const char* s, long hi) {
  if (!*s) return -1;
  long v = 0;
  for (; *s; s++) {
    if (*s < '0' || *s > '9') return -1;
    v = v * 10 + (*s - '0');
    if (v > hi) return -1;
  }
  return v;
}

void handleLine() {
  line[len] = '\0';
  // tokenize on spaces (ignore leading/trailing/extra)
  char* tok[4];
  int n = 0;
  char* p = line;
  while (*p && n < 4) {
    while (*p == ' ') p++;
    if (!*p) break;
    tok[n++] = p;
    while (*p && *p != ' ') p++;
    if (*p) *p++ = '\0';
  }
  bool extra = false;
  while (*p) { if (*p != ' ') { extra = true; break; } p++; }

  if (n >= 1 && !extra) {
    for (char* s = tok[0]; *s; s++) if (*s >= 'a' && *s <= 'z') *s -= 32;
    if (n == 2 && strcmp(tok[0], "DUTY") == 0) {
      long d = parseNum(tok[1], 255);
      if (d >= 0) {
        duty = (int)d;
        ramping = false;
        Serial.print("OK DUTY=");
        Serial.println(d);
        return;
      }
    } else if (n == 3 && strcmp(tok[0], "RAMP") == 0) {
      long d = parseNum(tok[1], 255);
      long ms = parseNum(tok[2], 10000);
      if (d >= 0 && ms >= 1) {
        rampFrom = duty;
        rampTo = d;
        rampDurMs = ms;
        rampStartMs = millis();
        lastRampMs = rampStartMs;
        ramping = true;
        Serial.print("OK RAMP=");
        Serial.println(d);
        return;
      }
    }
  }
  Serial.println("ERR");
}

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  digitalWrite(PWM_PIN, LOW);
  Serial.begin(115200);
  periodStart = micros();
}

void loop() {
  unsigned long nowUs = micros();

  // Advance the ramp at most once per millisecond (keeps the PWM loop fast).
  if (ramping) {
    unsigned long nowMs = millis();
    if (nowMs != lastRampMs) {
      lastRampMs = nowMs;
      unsigned long el = nowMs - rampStartMs;
      if (el >= rampDurMs) { duty = (int)(rampTo + 0.5); ramping = false; }
      else duty = (int)(rampFrom + (rampTo - rampFrom) * (float)el / (float)rampDurMs + 0.5);
    }
  }

  // Software PWM: HIGH for the first duty/255 of each 5 ms period.
  unsigned long into = nowUs - periodStart;
  if (into >= PERIOD_US) { periodStart += PERIOD_US; into = nowUs - periodStart; }
  unsigned long highUs = (unsigned long)duty * PERIOD_US / 255;
  bool want = into < highUs;
  if (want != pinHigh) { digitalWrite(PWM_PIN, want ? HIGH : LOW); pinHigh = want; }

  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (overlong) { Serial.println("ERR"); overlong = false; }
      else handleLine();
      len = 0;
      continue;
    }
    if (len >= 23) overlong = true;
    else line[len++] = c;
  }
}
