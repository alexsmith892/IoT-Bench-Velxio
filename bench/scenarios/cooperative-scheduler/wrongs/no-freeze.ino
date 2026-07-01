// cooperative_scheduler — adversarial wrong "no-freeze".
// Replies OK PAUSED / OK RUNNING correctly, but PAUSE does not actually stop the
// schedules — the virtual clock keeps advancing, so the four LEDs keep blinking
// while "paused". Fails the `edge-count` freeze contract (a paused LED must not
// toggle).

const int LED[4] = { 4, 5, 6, 7 };
const unsigned long PERIOD_US[4] = { 1000000UL, 500000UL, 333333UL, 200000UL };
const int BTN = 2;
const int RESP = 8;

unsigned long vUs = 0;
unsigned long lastUs = 0;
bool paused = false;

char line[16];
int len = 0;
bool overlong = false;

void handleLine() {
  line[len] = '\0';
  if (strcmp(line, "PAUSE") == 0) { paused = true; Serial.println("OK PAUSED"); return; }
  if (strcmp(line, "RESUME") == 0) { paused = false; Serial.println("OK RUNNING"); return; }
  Serial.println("ERR");
}

void setup() {
  for (int i = 0; i < 4; i++) { pinMode(LED[i], OUTPUT); digitalWrite(LED[i], LOW); }
  pinMode(BTN, INPUT_PULLUP);
  pinMode(RESP, OUTPUT);
  digitalWrite(RESP, LOW);
  Serial.begin(115200);
  lastUs = micros();
}

void loop() {
  unsigned long nowUs = micros();
  unsigned long dt = nowUs - lastUs;
  lastUs = nowUs;
  vUs += dt;  // BUG: advances even while paused

  for (int i = 0; i < 4; i++) {
    unsigned long ph = vUs % PERIOD_US[i];
    digitalWrite(LED[i], ph < PERIOD_US[i] / 2 ? LOW : HIGH);
  }
  digitalWrite(RESP, digitalRead(BTN) == LOW ? HIGH : LOW);

  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (overlong) { Serial.println("ERR"); overlong = false; }
      else handleLine();
      len = 0;
      continue;
    }
    if (len >= 15) overlong = true;
    else line[len++] = c;
  }
}
