// serial_control_protocol (OS-D2-07) — reference solution.
// Line-oriented control protocol @115200. Active-high LED on D7, PWM on D3, both
// start 0. Commands (LF/CRLF): "LED ON", "LED OFF", "PWM n" (0..255), "STATUS".
// Leading/trailing spaces ignored, command words case-insensitive, state persists.
// Malformed/unknown/missing-arg/non-decimal/out-of-range → ERR, change nothing.
// Every reply ends with a newline. Overlong line → discard to terminator, ERR once.

const int LED_PIN = 7;
const int PWM_PIN = 3;
const int MAX_LINE = 20;

char line[MAX_LINE + 1];
int len = 0;
bool overlong = false;

bool ledOn = false;
int pwmVal = 0;

// Uppercase a token in place (command words are case-insensitive; digits unaffected).
void upcase(char* s) {
  for (; *s; s++) if (*s >= 'a' && *s <= 'z') *s -= 32;
}

// Parse an unsigned decimal 0..255; return -1 on any non-digit or overflow/empty.
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
  // Split into up to two space-delimited tokens, skipping leading/trailing/extra spaces.
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
  // reject anything with a 3rd token
  bool extra = false;
  while (*p) { if (*p != ' ') { extra = true; break; } p++; }

  if (nTok == 0 || extra) { Serial.println("ERR"); return; }
  upcase(tokens[0]);

  if (nTok == 1 && strcmp(tokens[0], "STATUS") == 0) {
    Serial.print("STATUS LED=");
    Serial.print(ledOn ? "ON" : "OFF");
    Serial.print(" PWM=");
    Serial.println(pwmVal);
    return;
  }
  if (nTok == 2 && strcmp(tokens[0], "LED") == 0) {
    upcase(tokens[1]);
    if (strcmp(tokens[1], "ON") == 0) { ledOn = true; digitalWrite(LED_PIN, HIGH); Serial.println("OK LED=ON"); return; }
    if (strcmp(tokens[1], "OFF") == 0) { ledOn = false; digitalWrite(LED_PIN, LOW); Serial.println("OK LED=OFF"); return; }
  }
  if (nTok == 2 && strcmp(tokens[0], "PWM") == 0) {
    int n = parseByte(tokens[1]);
    if (n >= 0) {
      pwmVal = n;
      analogWrite(PWM_PIN, pwmVal);
      Serial.print("OK PWM=");
      Serial.println(pwmVal);
      return;
    }
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
