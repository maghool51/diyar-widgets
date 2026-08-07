/*!
 * Diyar Map Widget - widget.js
 * نسخه: 1.0.0
 * وابستگی الزامی: ندارد (Vanilla JS خالص)
 * وابستگی اختیاری: Leaflet (فقط برای نمایش نقشه؛ در صورت خطا در بارگذاری،
 *                    ویجت بدون خطا و بدون نقشه کار می‌کند)
 * سازگار با: Blogfa و هر پلتفرم استاتیک دیگر
 * -----------------------------------------------------------------
 */
(function () {
  "use strict";

  /* ============================================================
   * 1) کتابخانه‌ی سبک تولید QR Code (کاملاً محلی، بدون سرویس آنلاین)
   *    برگرفته و ساده‌سازی‌شده از الگوریتم استاندارد QR Code
   *    (مجوز اصلی: MIT - Kazuhiko Arase)
   * ============================================================ */
  var DiyarQR = (function () {
    var PAD0 = 0xEC, PAD1 = 0x11;

    function QR8bitByte(data) {
      this.mode = 4; // byte mode
      this.data = data;
      this.parsedData = [];
      for (var i = 0, l = this.data.length; i < l; i++) {
        var byteArray = [];
        var code = this.data.charCodeAt(i);
        if (code > 0x10000) {
          byteArray[0] = 0xF0 | ((code & 0x1C0000) >>> 18);
          byteArray[1] = 0x80 | ((code & 0x3F000) >>> 12);
          byteArray[2] = 0x80 | ((code & 0xFC0) >>> 6);
          byteArray[3] = 0x80 | (code & 0x3F);
        } else if (code > 0x800) {
          byteArray[0] = 0xE0 | ((code & 0xF000) >>> 12);
          byteArray[1] = 0x80 | ((code & 0xFC0) >>> 6);
          byteArray[2] = 0x80 | (code & 0x3F);
        } else if (code > 0x80) {
          byteArray[0] = 0xC0 | ((code & 0x7C0) >>> 6);
          byteArray[1] = 0x80 | (code & 0x3F);
        } else {
          byteArray[0] = code;
        }
        this.parsedData.push.apply(this.parsedData, byteArray);
      }
    }
    QR8bitByte.prototype = {
      getLength: function () { return this.parsedData.length; },
      write: function (buffer) {
        for (var i = 0, l = this.parsedData.length; i < l; i++) buffer.put(this.parsedData[i], 8);
      }
    };

    var QRMath = {
      glog: function (n) { if (n < 1) throw new Error("glog(" + n + ")"); return QRMath.LOG_TABLE[n]; },
      gexp: function (n) { while (n < 0) n += 255; while (n >= 256) n -= 255; return QRMath.EXP_TABLE[n]; },
      EXP_TABLE: new Array(256),
      LOG_TABLE: new Array(256)
    };
    for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
    for (var i = 8; i < 256; i++) {
      QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

    function QRPolynomial(num, shift) {
      if (num.length === undefined) throw new Error(num.length + "/" + shift);
      var offset = 0;
      while (offset < num.length && num[offset] === 0) offset++;
      this.num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    }
    QRPolynomial.prototype = {
      get: function (index) { return this.num[index]; },
      getLength: function () { return this.num.length; },
      multiply: function (e) {
        var num = new Array(this.getLength() + e.getLength() - 1);
        for (var i = 0; i < this.getLength(); i++) {
          for (var j = 0; j < e.getLength(); j++) {
            num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
          }
        }
        return new QRPolynomial(num, 0);
      },
      mod: function (e) {
        if (this.getLength() - e.getLength() < 0) return this;
        var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
        var num = new Array(this.getLength());
        for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
        for (var i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
        return new QRPolynomial(num, 0).mod(e);
      }
    };

    var QRRSBlock = {
      RS_BLOCK_TABLE: [
        [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
        [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
        [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
        [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
        [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
        [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
        [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
        [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
        [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
        [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]
      ],
      getRSBlocks: function (typeNumber, errorCorrectLevel) {
        var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
        if (!rsBlock) throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
        var length = rsBlock.length / 3;
        var list = [];
        for (var i = 0; i < length; i++) {
          var count = rsBlock[i * 3 + 0];
          var totalCount = rsBlock[i * 3 + 1];
          var dataCount = rsBlock[i * 3 + 2];
          for (var j = 0; j < count; j++) list.push({ totalCount: totalCount, dataCount: dataCount });
        }
        return list;
      },
      getRsBlockTable: function (typeNumber, errorCorrectLevel) {
        // برای سادگی و کوچک ماندن ویجت، فقط سطح M پشتیبانی و روی نسخه‌های کوچک (۱ تا ۱۰) تمرکز می‌شود
        var idx = (typeNumber - 1) * 4 + 1; // errorCorrectLevel M => index 1
        return QRRSBlock.RS_BLOCK_TABLE[idx];
      }
    };

    function QRBitBuffer() {
      this.buffer = [];
      this.length = 0;
    }
    QRBitBuffer.prototype = {
      get: function (index) { return ((this.buffer[Math.floor(index / 8)] >>> (7 - index % 8)) & 1) === 1; },
      put: function (num, length) { for (var i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1); },
      getLengthInBits: function () { return this.length; },
      putBit: function (bit) {
        var bufIndex = Math.floor(this.length / 8);
        if (this.buffer.length <= bufIndex) this.buffer.push(0);
        if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
        this.length++;
      }
    };

    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    function getBCHDigit(data) { var digit = 0; while (data !== 0) { digit++; data >>>= 1; } return digit; }
    function getBCHTypeInfo(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15)));
      return ((data << 10) | d) ^ G15_MASK;
    }
    function getBCHTypeNumber(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18)));
      return (data << 12) | d;
    }
    function getPatternPosition(typeNumber) { return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1]; }
    function getMask(maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 === 0;
        case 1: return i % 2 === 0;
        case 2: return j % 3 === 0;
        case 3: return (i + j) % 3 === 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case 5: return (i * j) % 2 + (i * j) % 3 === 0;
        case 6: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
        case 7: return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    }
    function getErrorCorrectPolynomial(errorCorrectLength) {
      var a = new QRPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      return a;
    }
    function getLengthInBits(mode, typeNumber) {
      // برای Byte Mode (mode=4): نسخه‌های ۱ تا ۹ از ۸ بیت و نسخه‌های ۱۰ به بعد از ۱۶ بیت استفاده می‌کنند
      return typeNumber >= 10 ? 16 : 8;
    }
    function getLostPoint(qrCode) {
      var moduleCount = qrCode.getModuleCount();
      var lostPoint = 0;
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          var sameCount = 0; var dark = qrCode.isDark(row, col);
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (var c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r === 0 && c === 0) continue;
              if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      for (var row = 0; row < moduleCount - 1; row++) {
        for (var col = 0; col < moduleCount - 1; col++) {
          var count = 0;
          if (qrCode.isDark(row, col)) count++;
          if (qrCode.isDark(row + 1, col)) count++;
          if (qrCode.isDark(row, col + 1)) count++;
          if (qrCode.isDark(row + 1, col + 1)) count++;
          if (count === 0 || count === 4) lostPoint += 3;
        }
      }
      return lostPoint;
    }

    var QRUtil = {
      PATTERN_POSITION_TABLE: [
        [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
        [6, 26, 46], [6, 28, 50]
      ],
      getErrorCorrectPolynomial: getErrorCorrectPolynomial,
      getMask: getMask,
      getLostPoint: getLostPoint,
      getBCHTypeInfo: getBCHTypeInfo,
      getBCHTypeNumber: getBCHTypeNumber,
      getPatternPosition: getPatternPosition
    };

    function QRCodeModel(typeNumber, data) {
      this.typeNumber = typeNumber;
      this.modules = null;
      this.moduleCount = 0;
      this.dataList = [new QR8bitByte(data)];
    }
    QRCodeModel.prototype = {
      isDark: function (row, col) {
        if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) throw new Error(row + "," + col);
        return this.modules[row][col];
      },
      getModuleCount: function () { return this.moduleCount; },
      make: function () { this.makeImpl(false, this.getBestMaskPattern()); },
      makeImpl: function (test, maskPattern) {
        this.moduleCount = this.typeNumber * 4 + 17;
        this.modules = [];
        for (var row = 0; row < this.moduleCount; row++) {
          this.modules[row] = [];
          for (var col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
        }
        this.setupPositionProbePattern(0, 0);
        this.setupPositionProbePattern(this.moduleCount - 7, 0);
        this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupPositionAdjustPattern();
        this.setupTimingPattern();
        this.setupTypeInfo(test, maskPattern);
        if (this.typeNumber >= 7) this.setupTypeNumber(test);
        var dataArr = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel || 1, this.dataList);
        this.mapData(dataArr, maskPattern);
      },
      setupPositionProbePattern: function (row, col) {
        for (var r = -1; r <= 7; r++) {
          if (row + r <= -1 || this.moduleCount <= row + r) continue;
          for (var c = -1; c <= 7; c++) {
            if (col + c <= -1 || this.moduleCount <= col + c) continue;
            if ((0 <= r && r <= 6 && (c === 0 || c === 6)) || (0 <= c && c <= 6 && (r === 0 || r === 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      },
      getBestMaskPattern: function () {
        var minLostPoint = 0, pattern = 0;
        for (var i = 0; i < 8; i++) {
          this.makeImpl(true, i);
          var lostPoint = getLostPoint(this);
          if (i === 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; }
        }
        return pattern;
      },
      setupTimingPattern: function () {
        for (var r = 8; r < this.moduleCount - 8; r++) { if (this.modules[r][6] !== null) continue; this.modules[r][6] = (r % 2 === 0); }
        for (var c = 8; c < this.moduleCount - 8; c++) { if (this.modules[6][c] !== null) continue; this.modules[6][c] = (c % 2 === 0); }
      },
      setupPositionAdjustPattern: function () {
        var pos = getPatternPosition(this.typeNumber);
        for (var i = 0; i < pos.length; i++) {
          for (var j = 0; j < pos.length; j++) {
            var row = pos[i], col = pos[j];
            if (this.modules[row][col] !== null) continue;
            for (var r = -2; r <= 2; r++) {
              for (var c = -2; c <= 2; c++) {
                if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) this.modules[row + r][col + c] = true;
                else this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      },
      setupTypeNumber: function (test) {
        var bits = getBCHTypeNumber(this.typeNumber);
        for (var i = 0; i < 18; i++) {
          var mod = (!test && ((bits >> i) & 1) === 1);
          this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        }
        for (var i = 0; i < 18; i++) {
          var mod = (!test && ((bits >> i) & 1) === 1);
          this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
      },
      setupTypeInfo: function (test, maskPattern) {
        // شاخص سطح تصحیح خطا در استاندارد QR: L=1, M=0, Q=3, H=2 — این ویجت همیشه از سطح M (=0) استفاده می‌کند
        var errorCorrectLevelBits = 0;
        var data = (errorCorrectLevelBits << 3) | maskPattern;
        var bits = getBCHTypeInfo(data);
        for (var i = 0; i < 15; i++) {
          var mod = (!test && ((bits >> i) & 1) === 1);
          if (i < 6) this.modules[i][8] = mod;
          else if (i < 8) this.modules[i + 1][8] = mod;
          else this.modules[this.moduleCount - 15 + i][8] = mod;
        }
        for (var i = 0; i < 15; i++) {
          var mod = (!test && ((bits >> i) & 1) === 1);
          if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
          else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
          else this.modules[8][15 - i - 1] = mod;
        }
        this.modules[this.moduleCount - 8][8] = (!test);
      },
      mapData: function (data, maskPattern) {
        var inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;
        for (var col = this.moduleCount - 1; col > 0; col -= 2) {
          if (col === 6) col--;
          while (true) {
            for (var c = 0; c < 2; c++) {
              if (this.modules[row][col - c] === null) {
                var dark = false;
                if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
                var mask = getMask(maskPattern, row, col - c);
                if (mask) dark = !dark;
                this.modules[row][col - c] = dark;
                bitIndex--;
                if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
              }
            }
            row += inc;
            if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
          }
        }
      }
    };
    QRCodeModel.PAD0 = PAD0; QRCodeModel.PAD1 = PAD1;
    QRCodeModel.createData = function (typeNumber, errorCorrectLevel, dataList) {
      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
      var buffer = new QRBitBuffer();
      for (var i = 0; i < dataList.length; i++) {
        var data = dataList[i];
        buffer.put(data.mode, 4);
        buffer.put(data.getLength(), getLengthInBits(data.mode, typeNumber));
        data.write(buffer);
      }
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
      if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error("داده برای ظرفیت QR بیش از حد بزرگ است");
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
      while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(false);
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) break;
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) break;
        buffer.put(PAD1, 8);
      }
      return QRCodeModel.createBytes(buffer, rsBlocks);
    };
    QRCodeModel.createBytes = function (buffer, rsBlocks) {
      var offset = 0, maxDcCount = 0, maxEcCount = 0;
      var dcdata = new Array(rsBlocks.length), ecdata = new Array(rsBlocks.length);
      for (var r = 0; r < rsBlocks.length; r++) {
        var dcCount = rsBlocks[r].dataCount, ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (var i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
        offset += dcCount;
        var rsPoly = getErrorCorrectPolynomial(ecCount);
        var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i++) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
        }
      }
      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
      var data = new Array(totalCodeCount), index = 0;
      for (var i = 0; i < maxDcCount; i++) for (var r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      for (var i = 0; i < maxEcCount; i++) for (var r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      return data;
    };

    // پیدا کردن کوچک‌ترین نسخه‌ای که داده در آن جا می‌شود (سطح خطا: M)
    function findMinType(dataLength) {
      for (var t = 1; t <= 10; t++) {
        try {
          var model = new QRCodeModel(t, "x".repeat ? "x".repeat(dataLength) : new Array(dataLength + 1).join("x"));
          model.errorCorrectLevel = 1;
          model.make();
          return t;
        } catch (e) { continue; }
      }
      return 10;
    }

    /**
     * رندر QR Code داخل یک canvas
     * @param {HTMLCanvasElement} canvas
     * @param {string} text
     * @param {number} size اندازه پیکسل خروجی
     */
    function render(canvas, text, size) {
      size = size || 120;
      var typeNumber = findMinType(text.length);
      var qr = new QRCodeModel(typeNumber, text);
      qr.errorCorrectLevel = 1; // M
      qr.make();
      var count = qr.getModuleCount();
      var cell = Math.floor(size / count) || 1;
      var pixelSize = cell * count;
      canvas.width = pixelSize;
      canvas.height = pixelSize;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pixelSize, pixelSize);
      ctx.fillStyle = "#000000";
      for (var row = 0; row < count; row++) {
        for (var col = 0; col < count; col++) {
          if (qr.isDark(row, col)) ctx.fillRect(col * cell, row * cell, cell, cell);
        }
      }
    }

    return { render: render };
  })();

  /* ============================================================
   * 2) توابع کمکی عمومی
   * ============================================================ */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function toRad(deg) { return deg * Math.PI / 180; }

  // فاصله بین دو مختصات به کیلومتر (فرمول Haversine)
  function haversineDistance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // زاویه‌ی مسیر (Bearing) بین دو مختصات، بر حسب درجه (۰ تا ۳۶۰)
  function calcBearing(lat1, lon1, lat2, lon2) {
    var y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    var x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    var brng = Math.atan2(y, x);
    return (toDeg(brng) + 360) % 360;
  }
  function toDeg(rad) { return rad * 180 / Math.PI; }

  function formatDistance(km) {
    if (km < 1) return Math.round(km * 1000) + " متر";
    return km.toFixed(1) + " کیلومتر";
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (e) { reject(e); }
    });
  }

  /* ============================================================
   * 3) آیکون‌های SVG
   * ============================================================ */
  var ICONS = {
    googleMaps: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.4 7.3 11.6.2.2.5.3.7.3s.5-.1.7-.3C13 21.4 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>',
    googleNavigation: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L2 12l6 1 1 6 3-6 6-1-6-10z" transform="rotate(45 12 12)"/></svg>',
    waze: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r="1.4" fill="#fff"/><circle cx="15" cy="10" r="1.4" fill="#fff"/><path d="M8 15c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>',
    neshan: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg>',
    balad: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 15l3-6 2 3 3-5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    appleMaps: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L4 6v12l8 4 8-4V6l-8-4zm0 2.3L18 7v10l-6 3-6-3V7l6-2.7z"/><circle cx="12" cy="11" r="2.3"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L4.5 20 12 16l7.5 4z"/></svg>'
  };

  /* ============================================================
   * 4) کلاس اصلی ویجت
   * ============================================================ */
  function DiyarMapWidget(config) {
    this.cfg = config;
    this.container = document.getElementById(config.containerId);
    this.toastEl = null;
    this.mapInitialized = false;
    if (!this.container) {
      console.warn("[DiyarMapWidget] عنصر با شناسه‌ی «" + config.containerId + "» پیدا نشد.");
      return;
    }
    this.init();
  }

  DiyarMapWidget.prototype.init = function () {
    try {
      this.applyTheme();
      this.render();
      this.setupLazyMap();
      this.setupGeolocation();
    } catch (err) {
      this.renderFatalError(err);
    }
  };

  DiyarMapWidget.prototype.applyTheme = function () {
    var mode = (this.cfg.features && this.cfg.features.darkMode) || "auto";
    var isDark = mode === "dark" || (mode === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    this.container.classList.add("diyar-widget");
    if (isDark) this.container.classList.add("diyar-dark");
    this.container.style.setProperty("--diyar-primary", this.cfg.primaryColor || "#6750A4");
  };

  DiyarMapWidget.prototype.renderFatalError = function (err) {
    this.container.innerHTML = "";
    this.container.className = "diyar-widget";
    this.container.appendChild(el("div", { class: "diyar-widget__error", role: "alert" }, [
      document.createTextNode("ویجت دیار با خطا مواجه شد و در حالت محدود نمایش داده می‌شود.")
    ]));
    console.error("[DiyarMapWidget]", err);
  };

  DiyarMapWidget.prototype.render = function () {
    var cfg = this.cfg;
    var labels = cfg.labels || {};
    this.container.innerHTML = "";
    this.container.setAttribute("role", "region");
    this.container.setAttribute("aria-label", labels.title || "موقعیت و مسیریابی");

    // تصویر با Lazy Loading
    if (cfg.image) {
      var img = el("img", {
        class: "diyar-widget__image",
        alt: cfg.placeName || "تصویر مکان",
        loading: "lazy"
      });
      img.addEventListener("load", function () { img.classList.add("diyar-loaded"); });
      img.addEventListener("error", function () {
        img.parentElement && img.parentElement.remove();
      });
      img.src = cfg.image;
      this.container.appendChild(el("div", { class: "diyar-widget__image-wrap" }, [img]));
    }

    var body = el("div", { class: "diyar-widget__body" });
    body.appendChild(el("h3", { class: "diyar-widget__title" }, [document.createTextNode(cfg.placeName || "")]));
    if (cfg.address) body.appendChild(el("p", { class: "diyar-widget__address" }, [document.createTextNode(cfg.address)]));
    if (cfg.description) body.appendChild(el("p", { class: "diyar-widget__desc" }, [document.createTextNode(cfg.description)]));

    // نقشه
    if (cfg.features && cfg.features.showMap !== false) {
      this.mapEl = el("div", {
        class: "diyar-widget__map",
        id: cfg.containerId + "-leaflet",
        role: "img",
        "aria-label": "نقشه‌ی موقعیت " + (cfg.placeName || "")
      }, [el("div", { class: "diyar-skeleton" }, [document.createTextNode("در حال آماده‌سازی نقشه…")])]);
      body.appendChild(this.mapEl);
    }

    // فاصله و جهت
    this.metaEl = el("div", { class: "diyar-widget__meta diyar-hidden", "aria-live": "polite" });
    body.appendChild(this.metaEl);

    // دکمه‌های مسیریابی
    var buttonsWrap = el("div", { class: "diyar-widget__buttons" });
    var btnDefs = this.getRouteButtons();
    btnDefs.forEach(function (b) {
      buttonsWrap.appendChild(el("a", {
        class: "diyar-btn",
        href: b.url,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": b.label,
        html: b.icon + "<span>" + b.label + "</span>"
      }));
    });
    body.appendChild(buttonsWrap);

    // اقدامات ثانویه: اشتراک‌گذاری / کپی
    var actions = el("div", { class: "diyar-widget__actions" });
    var self = this;

    if (cfg.features && cfg.features.showShare !== false) {
      actions.appendChild(el("button", {
        type: "button",
        class: "diyar-action-btn",
        html: ICONS.share + "<span>" + (labels.share || "اشتراک‌گذاری") + "</span>",
        onclick: function () { self.handleShare(); }
      }));
    }
    actions.appendChild(el("button", {
      type: "button",
      class: "diyar-action-btn",
      html: ICONS.copy + "<span>" + (labels.copyLink || "کپی لینک") + "</span>",
      onclick: function () { self.handleCopy(self.getGoogleMapsLink(), labels.copySuccess); }
    }));
    actions.appendChild(el("button", {
      type: "button",
      class: "diyar-action-btn",
      html: ICONS.pin + "<span>" + (labels.copyCoords || "کپی مختصات") + "</span>",
      onclick: function () {
        self.handleCopy(cfg.coordinates.lat + ", " + cfg.coordinates.lng, labels.copySuccess);
      }
    }));
    body.appendChild(actions);

    // QR Code
    if (cfg.features && cfg.features.showQRCode !== false) {
      var qrCanvas = el("canvas", { width: "96", height: "96", "aria-hidden": "true" });
      this.qrWrap = el("div", { class: "diyar-widget__qr" }, [
        qrCanvas,
        el("span", { class: "diyar-widget__qr-text" }, [document.createTextNode(labels.qrTitle || "اسکن برای مسیریابی سریع")])
      ]);
      body.appendChild(this.qrWrap);
      try {
        DiyarQR.render(qrCanvas, this.getGoogleMapsLink(), 96);
      } catch (e) {
        this.qrWrap.classList.add("diyar-hidden");
        console.warn("[DiyarMapWidget] تولید QR Code ممکن نشد:", e);
      }
    }

    this.container.appendChild(body);
    this.container.appendChild(el("div", { class: "diyar-widget__error diyar-hidden" }));
  };

  DiyarMapWidget.prototype.getGoogleMapsLink = function () {
    var c = this.cfg.coordinates;
    return "https://www.google.com/maps/search/?api=1&query=" + c.lat + "," + c.lng;
  };

DiyarMapWidget.prototype.getRouteButtons = function () {
  var cfg = this.cfg, c = cfg.coordinates, btns = cfg.buttons || {};
  var name = encodeURIComponent(cfg.placeName || "");

  var all = [
    {
      key: "googleMaps",
      label: "گوگل‌مپ",
      icon: ICONS.googleMaps,
      url: "https://www.google.com/maps/search/?api=1&query=" + c.lat + "," + c.lng
    },
    {
      key: "googleNavigation",
      label: "مسیریابی گوگل",
      icon: ICONS.googleNavigation,
      url: "https://www.google.com/maps/dir/?api=1&destination=" + c.lat + "," + c.lng + "&travelmode=driving"
    },
    {
      key: "waze",
      label: "ویز",
      icon: ICONS.waze,
      url: "https://waze.com/ul?ll=" + c.lat + "," + c.lng + "&navigate=yes"
    },
    {
      key: "neshan",
      label: "نشان",
      icon: ICONS.neshan,
      url: "https://neshan.org/maps?zoom=16&lat=" + c.lat + "&lng=" + c.lng
    },
    {
      key: "balad",
      label: "بلد",
      icon: ICONS.balad,
      url: "https://balad.ir/mapp?lat=" + c.lat + "&lng=" + c.lng + "&zoom=16"
    },
    {
      key: "appleMaps",
      label: "اپل‌مپ",
      icon: ICONS.appleMaps,
      url: "https://maps.apple.com/?q=" + name + "&ll=" + c.lat + "," + c.lng
    }
  ];

  return all.filter(function (b) {
    return btns[b.key] !== false;
  });
};

  DiyarMapWidget.prototype.handleShare = function () {
    var cfg = this.cfg, self = this;
    var shareData = {
      title: cfg.placeName || "موقعیت مکانی",
      text: cfg.description || cfg.placeName || "",
      url: this.getGoogleMapsLink()
    };
    if (navigator.share) {
      navigator.share(shareData).catch(function () { /* کاربر لغو کرد یا خطا رخ داد؛ نیازی به اقدام نیست */ });
    } else {
      this.handleCopy(shareData.url, (cfg.labels && cfg.labels.copySuccess));
    }
  };

  DiyarMapWidget.prototype.handleCopy = function (text, successMsg) {
    var self = this;
    copyText(text).then(function () {
      self.showToast(successMsg || "کپی شد!");
    }).catch(function () {
      self.showToast("امکان کپی وجود ندارد.");
    });
  };

  DiyarMapWidget.prototype.showToast = function (msg) {
    if (!this.toastEl) {
      this.toastEl = el("div", { class: "diyar-toast", role: "status", "aria-live": "polite" });
      document.body.appendChild(this.toastEl);
    }
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("diyar-show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function (t) { t.classList.remove("diyar-show"); }, 2200, this.toastEl);
  };

  /* ---------- نقشه (Leaflet) با Lazy Loading و مدیریت خطا ---------- */
  DiyarMapWidget.prototype.setupLazyMap = function () {
    if (!this.mapEl) return;
    var self = this;
    var lazy = this.cfg.features && this.cfg.features.lazyLoad !== false;
    if (!lazy || !("IntersectionObserver" in window)) {
      this.initMap();
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          self.initMap();
          observer.disconnect();
        }
      });
    }, { rootMargin: "200px" });
    observer.observe(this.mapEl);
  };

  DiyarMapWidget.prototype.initMap = function () {
    if (this.mapInitialized) return;
    this.mapInitialized = true;
    var self = this;

    function showFallback() {
      if (!self.mapEl) return;
      self.mapEl.innerHTML = "";
      self.mapEl.appendChild(el("div", { class: "diyar-widget__map-fallback" }, [
        document.createTextNode("نقشه در دسترس نیست؛ از دکمه‌های مسیریابی زیر استفاده کنید.")
      ]));
    }

    if (window.L && window.L.map) {
      this.drawLeafletMap();
      return;
    }

    // بارگذاری CSS
    if (!document.getElementById("diyar-leaflet-css")) {
      var link = document.createElement("link");
      link.id = "diyar-leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    var script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = function () {
      try { self.drawLeafletMap(); } catch (e) { console.warn("[DiyarMapWidget] خطا در رسم نقشه:", e); showFallback(); }
    };
    script.onerror = function () {
      console.warn("[DiyarMapWidget] بارگذاری Leaflet ناموفق بود؛ نمایش حالت جایگزین.");
      showFallback();
    };
    document.body.appendChild(script);

    // اگر پس از ۶ ثانیه هنوز نقشه بارگذاری نشده، به‌صورت خودکار fallback نمایش داده شود
    setTimeout(function () {
      if (!window.L || !self.mapEl || self.mapEl.querySelector(".leaflet-container")) return;
      showFallback();
    }, 6000);
  };

  DiyarMapWidget.prototype.drawLeafletMap = function () {
    var cfg = this.cfg, c = cfg.coordinates;
    if (!this.mapEl || !window.L) return;
    this.mapEl.innerHTML = "";
    var map = window.L.map(this.mapEl, {
      center: [c.lat, c.lng],
      zoom: cfg.mapZoom || 15,
      scrollWheelZoom: false,
      attributionControl: true
    });
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; مشارکت‌کنندگان OpenStreetMap"
    }).addTo(map);
    window.L.marker([c.lat, c.lng]).addTo(map).bindPopup(cfg.placeName || "");
  };

  /* ---------- موقعیت کاربر: فاصله و جهت ---------- */
  DiyarMapWidget.prototype.setupGeolocation = function () {
    var cfg = this.cfg;
    var wantDistance = cfg.features && cfg.features.showDistance !== false;
    var wantDirection = cfg.features && cfg.features.showDirection !== false;
    if ((!wantDistance && !wantDirection) || !("geolocation" in navigator)) return;

    var self = this;
    navigator.geolocation.getCurrentPosition(function (pos) {
      try {
        self.updateDistanceUI(pos.coords.latitude, pos.coords.longitude, wantDistance, wantDirection);
      } catch (e) { /* خطای نمایشی مهم نیست */ }
    }, function () {
      // کاربر اجازه نداد یا خطا رخ داد؛ بخش فاصله مخفی می‌ماند
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  };

  DiyarMapWidget.prototype.updateDistanceUI = function (userLat, userLng, wantDistance, wantDirection) {
    if (!this.metaEl) return;
    var cfg = this.cfg, c = cfg.coordinates, labels = cfg.labels || {};
    this.metaEl.innerHTML = "";
    this.metaEl.classList.remove("diyar-hidden");

    if (wantDistance) {
      var km = haversineDistance(userLat, userLng, c.lat, c.lng);
      this.metaEl.appendChild(el("span", {}, [
        document.createTextNode((labels.distancePrefix || "فاصله‌ی شما تا اینجا:") + " " + formatDistance(km))
      ]));
    }
    if (wantDirection) {
      var bearing = calcBearing(userLat, userLng, c.lat, c.lng);
      var arrow = el("span", {
        class: "diyar-widget__direction-arrow",
        html: ICONS.arrow,
        "aria-label": "جهت تقریبی مقصد"
      });
      arrow.style.transform = "rotate(" + bearing + "deg)";
      this.metaEl.appendChild(arrow);
    }
  };

  /* ============================================================
   * 5) راه‌اندازی خودکار
   * ============================================================ */
  function boot() {
    if (!window.DiyarMapConfig) {
      console.warn("[DiyarMapWidget] فایل config.js پیدا نشد یا پیش از widget.js بارگذاری نشده است.");
      return;
    }
    new DiyarMapWidget(window.DiyarMapConfig);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // در دسترس قرار دادن برای استفاده‌ی پیشرفته (مثلاً چند ویجت در یک صفحه)
  window.DiyarMapWidget = DiyarMapWidget;
})();
