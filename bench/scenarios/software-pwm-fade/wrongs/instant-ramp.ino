// software_pwm_fade — adversarial wrong "instant-ramp".
// Correct 200 Hz software PWM and correct DUTY handling, but RAMP jumps the duty
// to the target immediately instead of moving linearly over the given time. Fails
// the ramp variant's mid-ramp `duty` window (which expects an intermediate duty).

const int PWM_PIN = 8;
const unsigned long PERIOD_US = 5000;

int duty = 0;
unsigned long periodStart = 0;
bool pinHigh = false;

char line[24];
int len = 0;
bool overlong = false;

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
      if (d >= 0) { duty = (int)d; Serial.print("OK DUTY="); Serial.println(d); return; }
    } else if (n == 3 && strcmp(tok[0], "RAMP") == 0) {
      long d = parseNum(tok[1], 255);
      long ms = parseNum(tok[2], 10000);
      if (d >= 0 && ms >= 1) { duty = (int)d; Serial.print("OK RAMP="); Serial.println(d); return; }  // BUG: instant
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
