// WRONG (integer_overflow_accumulator): treats RESET as just another status query
// — it reports the current stats but never zeroes them. So after RESET the reply is
// not "N=0 SUM=0 MIN=0 MAX=0". Fails the decoded-value contract on the reset
// variant. expectFailCategory: serial-value.

const int MAX_LINE = 15;

char line[MAX_LINE + 1];
int len = 0;
bool overlong = false;

long long sumTotal = 0;
unsigned long count = 0;
long minV = 0, maxV = 0;

void printInt64(long long v) {
  if (v < 0) { Serial.print('-'); v = -v; }
  char tmp[20];
  int i = 0;
  if (v == 0) { Serial.print('0'); return; }
  unsigned long long u = (unsigned long long)v;
  while (u > 0) { tmp[i++] = char('0' + (int)(u % 10)); u /= 10; }
  while (i > 0) Serial.print(tmp[--i]);
}

void report() {
  Serial.print("N=");
  Serial.print(count);
  Serial.print(" SUM=");
  printInt64(sumTotal);
  Serial.print(" MIN=");
  Serial.print(minV);
  Serial.print(" MAX=");
  Serial.print(maxV);
  Serial.print('\n');
}

void processLine() {
  line[len] = '\0';
  if (len == 5 && strcmp(line, "RESET") == 0) { report(); return; } // BUG: does not zero

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
  sumTotal += (long long)val;
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
