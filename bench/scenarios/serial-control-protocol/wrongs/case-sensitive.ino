// WRONG (serial_control_protocol): matches command words case-SENSITIVELY (only
// uppercase). "led on" is rejected as ERR, so the LED never turns on for a
// lower-case command. Fails the pin-state (D7) contract on the case/spaces variant.
// expectFailCategory: pin-state.

const int LED_PIN = 7;
const int PWM_PIN = 3;
const int MAX_LINE = 20;

char line[MAX_LINE + 1];
int len = 0;
bool overlong = false;

bool ledOn = false;
int pwmVal = 0;

int parseByte(const char* s) {
  if (!*s) return -1;
  long v = 0;
  for (; *s; s++) {
    if (*s < '0' || *s > '9') return -1;
    v = v * 10 + (*s - '0');
    if (v > 255) return -1;
  }
  return (int)v;
}

void processLine() {
  line[len] = '\0';
  char* tokens[3];
  int nTok = 0;
  char* p = line;
  while (*p && nTok < 3) {
    while (*p == ' ') p++;
    if (!*p) break;
    tokens[nTok++] = p;
    while (*p && *p != ' ') p++;
    if (*p) *p++ = '\0';
  }
  bool extra = false;
  while (*p) { if (*p != ' ') { extra = true; break; } p++; }
  if (nTok == 0 || extra) { Serial.println("ERR"); return; }

  // BUG: no upcase — compares the raw (case-sensitive) tokens.
  if (nTok == 1 && strcmp(tokens[0], "STATUS") == 0) {
    Serial.print("STATUS LED=");
    Serial.print(ledOn ? "ON" : "OFF");
    Serial.print(" PWM=");
    Serial.println(pwmVal);
    return;
  }
  if (nTok == 2 && strcmp(tokens[0], "LED") == 0) {
    if (strcmp(tokens[1], "ON") == 0) { ledOn = true; digitalWrite(LED_PIN, HIGH); Serial.println("OK LED=ON"); return; }
    if (strcmp(tokens[1], "OFF") == 0) { ledOn = false; digitalWrite(LED_PIN, LOW); Serial.println("OK LED=OFF"); return; }
  }
  if (nTok == 2 && strcmp(tokens[0], "PWM") == 0) {
    int n = parseByte(tokens[1]);
    if (n >= 0) { pwmVal = n; analogWrite(PWM_PIN, pwmVal); Serial.print("OK PWM="); Serial.println(pwmVal); return; }
  }
  Serial.println("ERR");
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(PWM_PIN, OUTPUT);
  analogWrite(PWM_PIN, 0);
  Serial.begin(115200);
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (overlong) { Serial.println("ERR"); overlong = false; }
      else processLine();
      len = 0;
      continue;
    }
    if (len >= MAX_LINE) overlong = true;
    else line[len++] = c;
  }
}
