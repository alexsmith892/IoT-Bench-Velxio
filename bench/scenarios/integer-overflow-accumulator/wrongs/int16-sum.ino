// WRONG (integer_overflow_accumulator): keeps the running SUM in a 16-bit `int`
// (the default AVR int). Two full-magnitude samples already overflow it, so the
// reported SUM wraps and is wrong. Fails the decoded-value contract on the overflow
// variant. expectFailCategory: serial-value.

const int MAX_LINE = 15;

char line[MAX_LINE + 1];
int len = 0;
bool overlong = false;

int sumTotal = 0;   // BUG: 16-bit accumulator overflows at 32767
unsigned long count = 0;
long minV = 0, maxV = 0;

void report() {
  Serial.print("N=");
  Serial.print(count);
  Serial.print(" SUM=");
  Serial.print(sumTotal);
  Serial.print(" MIN=");
  Serial.print(minV);
  Serial.print(" MAX=");
  Serial.print(maxV);
  Serial.print('\n');
}

void resetStats() {
  sumTotal = 0;
  count = 0;
  minV = 0;
  maxV = 0;
  report();
}

void processLine() {
  line[len] = '\0';
  if (len == 5 && strcmp(line, "RESET") == 0) { resetStats(); return; }
  if (len == 0) { Serial.println("ERR"); return; }

  int i = 0;
  bool neg = false;
  if (line[0] == '-') { neg = true; i = 1; if (len == 1) { Serial.println("ERR"); return; } }
  long val = 0;
  for (; i < len; i++) {
    if (line[i] < '0' || line[i] > '9') { Serial.println("ERR"); return; }
    val = val * 10 + (line[i] - '0');
    if (val > 100000L) { Serial.println("ERR"); return; }
  }
  if (neg) val = -val;
  if (val < -32768L || val > 32767L) { Serial.println("ERR"); return; }

  count++;
  sumTotal += (int)val; // overflows
  if (count == 1) { minV = val; maxV = val; }
  else { if (val < minV) minV = val; if (val > maxV) maxV = val; }
  report();
}

void setup() {
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
