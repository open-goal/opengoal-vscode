;------------------------------------------
;  top-level segment
;------------------------------------------

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; .function (top-level-login air)
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  ;stack: total 0x00, fp? 0 ra? 0 ep? 1
;; Warnings:
;; INFO: Return type mismatch function vs none.

B0:
    lui v1, L18               ;; [  0] (set! v1-0 L18) [] -> [v1: (function vector (inline-array air-box) int symbol) ]
    ori v1, v1, L18
    sw v1, point-in-air?(s7)  ;; [  1] (s.w! point-in-air? v1-0)
                              ;; [v1: (function vector (inline-array air-box) int symbol) ] -> []
    lui v1, L1                ;; [  2] (set! v1-1 L1)
                              ;; [] -> [v1: (function vector vector (inline-array air-box) int symbol) ]
    ori v1, v1, L1
    sw v1, points-in-air?(s7) ;; [  3] (s.w! points-in-air? v1-1)
                              ;; [v1: (function vector vector (inline-array air-box) int symbol) ] -> []
    lw v1, *debug-segment*(s7);; [  4] (set! v1-2 *debug-segment*) [] -> [v1: symbol ]
    beq s7, v1, L40           ;; [  5] (b! (not v1-2) L40 (nop!)) [v1: symbol ] -> []
    sll r0, r0, 0

B1:
    lui v1, L29               ;; [  6] (set! v0-0 L29) [] -> [v0: (function bucket-id air-box symbol) ]
    ori v0, v1, L29
    sw v0, add-debug-air-box(s7);; [  7] (s.w! add-debug-air-box v0-0) [v0: (function bucket-id air-box symbol) ] -> []
    beq r0, r0, L41           ;; [  8] (b! #t L41 (nop!)) [] -> []
    sll r0, r0, 0

B2:
L40:
    lw v0, nothing(s7)        ;; [  9] (set! v0-1 nothing) [] -> [v0: (function none) ]
    sw v0, add-debug-air-box(s7);; [ 10] (s.w! add-debug-air-box v0-1) [v0: (function none) ] -> []
B3:
L41:
    jr ra
    daddu sp, sp, r0



;;-*-OpenGOAL-Start-*-

(top-level-function
  ()
  (set! point-in-air? L18)
  (set! points-in-air? L1)
  (if *debug-segment*
      (set! add-debug-air-box L29)
      (set! add-debug-air-box (the-as (function bucket-id air-box symbol) nothing))
      )
  (none)
  )

;;-*-OpenGOAL-End-*-

;; .endfunction

L42:
    .word 0x0
    .word 0x0

;------------------------------------------
;  debug segment
;------------------------------------------

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; .function add-debug-air-box
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  ;stack: total 0x80, fp? 1 ra? 1 ep? 1
  ;stack_vars: 32 bytes at 16
  ;gprs: gp s5 s4 s3 s2
;; Warnings:
;; Used lq/sq

;;  v1-0: air-box    a0-0: bucket-id  a0-1: symbol     a1-0: air-box    a1-1: vector     s2-0: uint      
;;  s4-0: vector     s5-0: vector     f0-4: float      f0-6: float      f1-5: float      f2-1: float     
L29:
    daddiu sp, sp, -128
    sd ra, 0(sp)
    sd fp, 8(sp)
    or fp, t9, r0
    sq s2, 48(sp)
    sq s3, 64(sp)
    sq s4, 80(sp)
    sq s5, 96(sp)
    sq gp, 112(sp)
B0:
    or gp, a0, r0             ;; [  0] (set! arg0 arg0) [a0: bucket-id ] -> [gp: bucket-id ]
    or s3, a1, r0             ;; [  1] (set! arg1 arg1) [a1: air-box ] -> [s3: air-box ]
    lw t9, camera-pos(s7)     ;; [  2] (set! t9-0 camera-pos) [] -> [t9: (function vector) ]
    jalr ra, t9               ;; [  3] (call!)     [t9: (function vector) ] -> [v0: vector ]
    sll v0, ra, 0

    or a1, v0, r0             ;; [  4] (set! a1-1 v0-0) [v0: vector ] -> [a1: vector ]
    daddiu s5, sp, 16         ;; [  5] (set! s5-0 (+ sp-0 16)) [sp: <uninitialized> ] -> [s5: vector ]
    daddiu s4, sp, 32         ;; [  6] (set! s4-0 (+ sp-0 32)) [sp: <uninitialized> ] -> [s4: vector ]
    lwc1 f0, 12(s3)           ;; [  7] (set! f0-0 (l.f (+ arg1 12))) [s3: air-box ] -> []
    lwc1 f0, 28(s3)           ;; [  8] (set! f0-1 (l.f (+ arg1 28))) [s3: air-box ] -> []
    ld s2, L39(fp)            ;; [  9] (set! s2-0 (l.d L39)) [] -> [s2: uint ]
    or v1, s3, r0             ;; [ 10] (set! v1-0 arg1) [s3: air-box ] -> [v1: air-box ]
    lwc1 f0, 4(v1)            ;; [ 11] (set! f0-2 (l.f (+ v1-0 4))) [v1: air-box ] -> []
    lwc1 f1, 4(a1)            ;; [ 12] (set! f1-0 (l.f (+ a1-1 4))) [a1: vector ] -> []
    c.lt.s f0, f1             ;; [ 13] (b! (>=.s f0-2 f1-0) L34 (set! a0-1 #f)) [] -> [a0: '#f ]
    bc1f L34
    or a0, s7, r0

B1:
    lwc1 f0, 0(a1)            ;; [ 14] (set! f0-3 (l.f a1-1)) [a1: vector ] -> []
    lwc1 f1, 0(v1)            ;; [ 15] (set! f1-1 (l.f v1-0)) [v1: air-box ] -> []
    sub.s f0, f0, f1          ;; [ 16] (set! f0-4 (-.s f0-3 f1-1)) [] -> []
    lwc1 f1, 8(a1)            ;; [ 17] (set! f1-2 (l.f (+ a1-1 8))) [a1: vector ] -> []
    lwc1 f2, 8(v1)            ;; [ 18] (set! f2-0 (l.f (+ v1-0 8))) [v1: air-box ] -> []
    sub.s f2, f1, f2          ;; [ 19] (set! f2-1 (-.s f1-2 f2-0)) [] -> []
    or a0, s7, r0             ;; [ 20] (set! a0-1 #f) [] -> [a0: '#f ]
    lwc1 f1, 12(v1)           ;; [ 21] (set! f1-3 (l.f (+ v1-0 12))) [v1: air-box ] -> []
    mul.s f1, f0, f1          ;; [ 22] (set! f1-4 (*.s f0-4 f1-3)) [] -> []
    lwc1 f3, 28(v1)           ;; [ 23] (set! f3-0 (l.f (+ v1-0 28))) [v1: air-box ] -> []
    mul.s f3, f2, f3          ;; [ 24] (set! f3-1 (*.s f2-1 f3-0)) [] -> []
    add.s f1, f1, f3          ;; [ 25] (set! f1-5 (+.s f1-4 f3-1)) [] -> []
    lwc1 f3, 12(v1)           ;; [ 26] (set! f3-2 (l.f (+ v1-0 12))) [v1: air-box ] -> []
    mul.s f2, f2, f3          ;; [ 27] (set! f2-2 (*.s f2-1 f3-2)) [] -> []
    lwc1 f3, 28(v1)           ;; [ 28] (set! f3-3 (l.f (+ v1-0 28))) [v1: air-box ] -> []
    mul.s f0, f0, f3          ;; [ 29] (set! f0-5 (*.s f0-4 f3-3)) [] -> []
    sub.s f0, f2, f0          ;; [ 30] (set! f0-6 (-.s f2-2 f0-5)) [] -> []
    mtc1 f2, r0               ;; [ 31] (set! f2-3 0) [] -> []
    c.lt.s f1, f2             ;; [ 32] (b! (>=.s f1-5 f2-3) L30 (set! a1-2 #t)) [] -> [a1: symbol ]
    bc1f L30
    daddiu a1, s7, 8

B2:
    or a1, s7, r0             ;; [ 33] (set! a1-2 #f) [] -> [a1: '#f ]
B3:
L30:
    beql s7, a1, L33          ;; [ 34] (bl! (not a1-2) L33 (no-delay!)) [a1: symbol ] -> []
B4:
    or v1, a1, r0             ;; [ 35] (set! v1-1 a1-2) [a1: symbol ] -> [v1: symbol ]

B5:
    mtc1 f2, r0               ;; [ 36] (set! f2-4 0) [] -> []
    c.lt.s f0, f2             ;; [ 37] (b! (>=.s f0-6 f2-4) L31 (set! a1-3 #t)) [] -> [a1: symbol ]
    bc1f L31
    daddiu a1, s7, 8

B6:
    or a1, s7, r0             ;; [ 38] (set! a1-3 #f) [] -> [a1: '#f ]
B7:
L31:
    beql s7, a1, L33          ;; [ 39] (bl! (not a1-3) L33 (no-delay!)) [a1: symbol ] -> []
B8:
    or v1, a1, r0             ;; [ 40] (set! v1-1 a1-3) [a1: symbol ] -> [v1: symbol ]

B9:
    lwc1 f2, 16(v1)           ;; [ 41] (set! f2-5 (l.f (+ v1-0 16))) [v1: air-box ] -> []
    c.lt.s f1, f2             ;; [ 42] (b! (<.s f1-5 f2-5) L32 (set! a1-4 #t)) [] -> [a1: symbol ]
    bc1t L32
    daddiu a1, s7, 8

B10:
    or a1, s7, r0             ;; [ 43] (set! a1-4 #f) [] -> [a1: '#f ]
B11:
L32:
    beql s7, a1, L33          ;; [ 44] (bl! (not a1-4) L33 (no-delay!)) [a1: symbol ] -> []
B12:
    or v1, a1, r0             ;; [ 45] (set! v1-1 a1-4) [a1: symbol ] -> [v1: symbol ]

B13:
    lwc1 f1, 24(v1)           ;; [ 46] (set! f1-6 (l.f (+ v1-0 24))) [v1: air-box ] -> []
    c.lt.s f0, f1             ;; [ 47] (b! (<.s f0-6 f1-6) L33 (set! v1-1 #t)) [] -> [v1: symbol ]
    bc1t L33
    daddiu v1, s7, 8

B14:
    or v1, s7, r0             ;; [ 48] (set! v1-1 #f) [] -> [v1: '#f ]
B15:
L33:
    beq s7, v1, L34           ;; [ 49] (b! (not v1-1) L34 (set! v1-2 #f)) [v1: symbol ] -> [v1: '#f ]
    or v1, s7, r0

B16:
    daddiu a0, s7, #t         ;; [ 50] (set! a0-1 #t) [] -> [a0: symbol ]
    or v1, a0, r0             ;; [ 51] (set! v1-3 a0-1) [a0: symbol ] -> [v1: symbol ]
B17:
L34:
    beq s7, a0, L35           ;; [ 52] (b! (not a0-1) L35 (set! v1-4 #f)) [a0: symbol ] -> [v1: '#f ]
    or v1, s7, r0

B18:
    ld s2, L38(fp)            ;; [ 53] (set! s2-0 (l.d L38)) [] -> [s2: uint ]
    or v1, s2, r0             ;; [ 54] (set! v1-5 s2-0) [s2: uint ] -> [v1: uint ]
B19:
L35:
    lwc1 f0, 4(s3)            ;; [ 55] (set! f0-7 (l.f (+ arg1 4))) [s3: air-box ] -> []
    swc1 f0, 4(s5)            ;; [ 56] (s.f! (+ s5-0 4) f0-7) [s5: vector ] -> []
    lwc1 f0, 4(s3)            ;; [ 57] (set! f0-8 (l.f (+ arg1 4))) [s3: air-box ] -> []
    swc1 f0, 4(s4)            ;; [ 58] (s.f! (+ s4-0 4) f0-8) [s4: vector ] -> []
    lwc1 f0, L37(fp)          ;; [ 59] (set! f0-9 (l.f L37)) [] -> []
    swc1 f0, 12(s5)           ;; [ 60] (s.f! (+ s5-0 12) f0-9) [s5: vector ] -> []
    lwc1 f0, L37(fp)          ;; [ 61] (set! f0-10 (l.f L37)) [] -> []
    swc1 f0, 12(s4)           ;; [ 62] (s.f! (+ s4-0 12) f0-10) [s4: vector ] -> []
    lwc1 f0, 0(s3)            ;; [ 63] (set! f0-11 (l.f arg1)) [s3: air-box ] -> []
    swc1 f0, 0(s5)            ;; [ 64] (s.f! s5-0 f0-11) [s5: vector ] -> []
    lwc1 f0, 8(s3)            ;; [ 65] (set! f0-12 (l.f (+ arg1 8))) [s3: air-box ] -> []
    swc1 f0, 8(s5)            ;; [ 66] (s.f! (+ s5-0 8) f0-12) [s5: vector ] -> []
    lwc1 f0, 0(s3)            ;; [ 67] (set! f0-13 (l.f arg1)) [s3: air-box ] -> []
    lwc1 f1, 12(s3)           ;; [ 68] (set! f1-7 (l.f (+ arg1 12))) [s3: air-box ] -> []
    lwc1 f2, 16(s3)           ;; [ 69] (set! f2-6 (l.f (+ arg1 16))) [s3: air-box ] -> []
    mul.s f1, f1, f2          ;; [ 70] (set! f1-8 (*.s f1-7 f2-6)) [] -> []
    add.s f0, f0, f1          ;; [ 71] (set! f0-14 (+.s f0-13 f1-8)) [] -> []
    swc1 f0, 0(s4)            ;; [ 72] (s.f! s4-0 f0-14) [s4: vector ] -> []
    lwc1 f0, 8(s3)            ;; [ 73] (set! f0-15 (l.f (+ arg1 8))) [s3: air-box ] -> []
    lwc1 f1, 28(s3)           ;; [ 74] (set! f1-9 (l.f (+ arg1 28))) [s3: air-box ] -> []
    lwc1 f2, 16(s3)           ;; [ 75] (set! f2-7 (l.f (+ arg1 16))) [s3: air-box ] -> []
    mul.s f1, f1, f2          ;; [ 76] (set! f1-10 (*.s f1-9 f2-7)) [] -> []
    add.s f0, f0, f1          ;; [ 77] (set! f0-16 (+.s f0-15 f1-10)) [] -> []
    swc1 f0, 8(s4)            ;; [ 78] (s.f! (+ s4-0 8) f0-16) [s4: vector ] -> []
    lw t9, add-debug-line(s7) ;; [ 79] (set! t9-1 add-debug-line)
                              ;; [] -> [t9: (function symbol bucket-id vector vector rgba symbol rgba symbol) ]
    daddiu a0, s7, #t         ;; [ 80] (set! a0-2 #t) [] -> [a0: symbol ]
    or a1, gp, r0             ;; [ 81] (set! a1-5 arg0) [gp: bucket-id ] -> [a1: bucket-id ]
    or a2, s5, r0             ;; [ 82] (set! a2-0 s5-0) [s5: vector ] -> [a2: vector ]
    or a3, s4, r0             ;; [ 83] (set! a3-0 s4-0) [s4: vector ] -> [a3: vector ]
    or t0, s2, r0             ;; [ 84] (set! t0-0 s2-0) [s2: uint ] -> [t0: uint ]
    or t1, s7, r0             ;; [ 85] (set! t1-0 #f) [] -> [t1: '#f ]
    addiu t2, r0, -1          ;; [ 86] (set! t2-0 -1) [] -> [t2: <integer -1> ]
    jalr ra, t9               ;; [ 87] (call! a0-2 a1-5 a2-0 a3-0 t0-0 t1-0 t2-0)
                              ;; [a0: symbol a1: bucket-id a2: vector a3: vector t0: uint t1: '#f t2: <integer -1> t9: (function symbol bucket-id vector vector rgba symbol rgba symbol) ] -> [v0: symbol ]
    sll v0, ra, 0

    or v1, s5, r0             ;; [ 88] (set! v1-6 s5-0) [s5: vector ] -> [v1: vector ]
    or a0, s4, r0             ;; [ 89] (set! a0-3 s4-0) [s4: vector ] -> [a0: vector ]
    lq a0, 0(a0)              ;; [ 90] (set! a0-4 (l.q a0-3)) [a0: vector ] -> [a0: uint128 ]
    sq a0, 0(v1)              ;; [ 91] (s.q! v1-6 a0-4) [v1: vector a0: uint128 ] -> []
    lwc1 f0, 0(s5)            ;; [ 92] (set! f0-17 (l.f s5-0)) [s5: vector ] -> []
    lwc1 f1, 28(s3)           ;; [ 93] (set! f1-11 (l.f (+ arg1 28))) [s3: air-box ] -> []
    neg.s f1, f1              ;; [ 94] (set! f1-12 (neg.s f1-11)) [] -> []
    lwc1 f2, 24(s3)           ;; [ 95] (set! f2-8 (l.f (+ arg1 24))) [s3: air-box ] -> []
    mul.s f1, f1, f2          ;; [ 96] (set! f1-13 (*.s f1-12 f2-8)) [] -> []
    add.s f0, f0, f1          ;; [ 97] (set! f0-18 (+.s f0-17 f1-13)) [] -> []
    swc1 f0, 0(s4)            ;; [ 98] (s.f! s4-0 f0-18) [s4: vector ] -> []
    lwc1 f0, 8(s5)            ;; [ 99] (set! f0-19 (l.f (+ s5-0 8))) [s5: vector ] -> []
    lwc1 f1, 12(s3)           ;; [100] (set! f1-14 (l.f (+ arg1 12))) [s3: air-box ] -> []
    lwc1 f2, 24(s3)           ;; [101] (set! f2-9 (l.f (+ arg1 24))) [s3: air-box ] -> []
    mul.s f1, f1, f2          ;; [102] (set! f1-15 (*.s f1-14 f2-9)) [] -> []
    add.s f0, f0, f1          ;; [103] (set! f0-20 (+.s f0-19 f1-15)) [] -> []
    swc1 f0, 8(s4)            ;; [104] (s.f! (+ s4-0 8) f0-20) [s4: vector ] -> []
    lw t9, add-debug-line(s7) ;; [105] (set! t9-2 add-debug-line)
                              ;; [] -> [t9: (function symbol bucket-id vector vector rgba symbol rgba symbol) ]
    daddiu a0, s7, #t         ;; [106] (set! a0-5 #t) [] -> [a0: symbol ]
    or a1, gp, r0             ;; [107] (set! a1-6 arg0) [gp: bucket-id ] -> [a1: bucket-id ]
    or a2, s5, r0             ;; [108] (set! a2-1 s5-0) [s5: vector ] -> [a2: vector ]
    or a3, s4, r0             ;; [109] (set! a3-1 s4-0) [s4: vector ] -> [a3: vector ]
    or t0, s2, r0             ;; [110] (set! t0-1 s2-0) [s2: uint ] -> [t0: uint ]
    or t1, s7, r0             ;; [111] (set! t1-1 #f) [] -> [t1: '#f ]
    addiu t2, r0, -1          ;; [112] (set! t2-1 -1) [] -> [t2: <integer -1> ]
    jalr ra, t9               ;; [113] (call! a0-5 a1-6 a2-1 a3-1 t0-1 t1-1 t2-1)
                              ;; [a0: symbol a1: bucket-id a2: vector a3: vector t0: uint t1: '#f t2: <integer -1> t9: (function symbol bucket-id vector vector rgba symbol rgba symbol) ] -> [v0: symbol ]
    sll v0, ra, 0

    lwc1 f0, 0(s3)            ;; [114] (set! f0-21 (l.f arg1)) [s3: air-box ] -> []
    lwc1 f1, 28(s3)           ;; [115] (set! f1-16 (l.f (+ arg1 28))) [s3: air-box ] -> []
    neg.s f1, f1              ;; [116] (set! f1-17 (neg.s f1-16)) [] -> []
    lwc1 f2, 24(s3)           ;; [117] (set! f2-10 (l.f (+ arg1 24))) [s3: air-box ] -> []
    mul.s f1, f1, f2          ;; [118] (set! f1-18 (*.s f1-17 f2-10)) [] -> []
    add.s f0, f0, f1          ;; [119] (set! f0-22 (+.s f0-21 f1-18)) [] -> []
    swc1 f0, 0(s5)            ;; [120] (s.f! s5-0 f0-22) [s5: vector ] -> []
    lwc1 f0, 8(s3)            ;; [121] (set! f0-23 (l.f (+ arg1 8))) [s3: air-box ] -> []
    lwc1 f1, 12(s3)           ;; [122] (set! f1-19 (l.f (+ arg1 12))) [s3: air-box ] -> []
    lwc1 f2, 24(s3)           ;; [123] (set! f2-11 (l.f (+ arg1 24))) [s3: air-box ] -> []
    mul.s f1, f1, f2          ;; [124] (set! f1-20 (*.s f1-19 f2-11)) [] -> []
    add.s f0, f0, f1          ;; [125] (set! f0-24 (+.s f0-23 f1-20)) [] -> []
    swc1 f0, 8(s5)            ;; [126] (s.f! (+ s5-0 8) f0-24) [s5: vector ] -> []
    lw t9, add-debug-line(s7) ;; [127] (set! t9-3 add-debug-line)
                              ;; [] -> [t9: (function symbol bucket-id vector vector rgba symbol rgba symbol) ]
    daddiu a0, s7, #t         ;; [128] (set! a0-6 #t) [] -> [a0: symbol ]
    or a1, gp, r0             ;; [129] (set! a1-7 arg0) [gp: bucket-id ] -> [a1: bucket-id ]
    or a2, s5, r0             ;; [130] (set! a2-2 s5-0) [s5: vector ] -> [a2: vector ]
    or a3, s4, r0             ;; [131] (set! a3-2 s4-0) [s4: vector ] -> [a3: vector ]
    or t0, s2, r0             ;; [132] (set! t0-2 s2-0) [s2: uint ] -> [t0: uint ]
    or t1, s7, r0             ;; [133] (set! t1-2 #f) [] -> [t1: '#f ]
    addiu t2, r0, -1          ;; [134] (set! t2-2 -1) [] -> [t2: <integer -1> ]
    jalr ra, t9               ;; [135] (call! a0-6 a1-7 a2-2 a3-2 t0-2 t1-2 t2-2)
                              ;; [a0: symbol a1: bucket-id a2: vector a3: vector t0: uint t1: '#f t2: <integer -1> t9: (function symbol bucket-id vector vector rgba symbol rgba symbol) ] -> [v0: symbol ]
    sll v0, ra, 0

    lwc1 f0, 0(s3)            ;; [136] (set! f0-25 (l.f arg1)) [s3: air-box ] -> []
    swc1 f0, 0(s4)            ;; [137] (s.f! s4-0 f0-25) [s4: vector ] -> []
    lwc1 f0, 8(s3)            ;; [138] (set! f0-26 (l.f (+ arg1 8))) [s3: air-box ] -> []
    swc1 f0, 8(s4)            ;; [139] (s.f! (+ s4-0 8) f0-26) [s4: vector ] -> []
    lw t9, add-debug-line(s7) ;; [140] (set! t9-4 add-debug-line)
                              ;; [] -> [t9: (function symbol bucket-id vector vector rgba symbol rgba symbol) ]
    daddiu a0, s7, #t         ;; [141] (set! a0-7 #t) [] -> [a0: symbol ]
    or t1, s7, r0             ;; [142] (set! t1-3 #f) [] -> [t1: '#f ]
    addiu t2, r0, -1          ;; [143] (set! t2-3 -1) [] -> [t2: <integer -1> ]
    or a1, gp, r0             ;; [144] (set! a1-8 arg0) [gp: bucket-id ] -> [a1: bucket-id ]
    or a2, s5, r0             ;; [145] (set! a2-3 s5-0) [s5: vector ] -> [a2: vector ]
    or a3, s4, r0             ;; [146] (set! a3-3 s4-0) [s4: vector ] -> [a3: vector ]
    or t0, s2, r0             ;; [147] (set! t0-3 s2-0) [s2: uint ] -> [t0: uint ]
    jalr ra, t9               ;; [148] (call! a0-7 a1-8 a2-3 a3-3 t0-3 t1-3 t2-3)
                              ;; [a0: symbol a1: bucket-id a2: vector a3: vector t0: uint t1: '#f t2: <integer -1> t9: (function symbol bucket-id vector vector rgba symbol rgba symbol) ] -> [v0: symbol ]
    sll v0, ra, 0

    ld ra, 0(sp)
    ld fp, 8(sp)
    lq gp, 112(sp)
    lq s5, 96(sp)
    lq s4, 80(sp)
    lq s3, 64(sp)
    lq s2, 48(sp)
    jr ra
    daddiu sp, sp, 128



;;-*-OpenGOAL-Start-*-

(defun add-debug-air-box ((arg0 bucket-id) (arg1 air-box))
  (local-vars (a0-1 symbol))
  (let ((a1-1 (camera-pos))
        (s5-0 (new 'stack-no-clear 'vector))
        (s4-0 (new 'stack-no-clear 'vector))
        )
    (-> arg1 cos-angle)
    (-> arg1 sin-angle)
    (let ((s2-0 (the-as uint #x800000ff)))
      (let ((v1-0 arg1))
        (set! a0-1
              (when (< (-> v1-0 height-level) (-> a1-1 y))
                (let ((f0-4 (- (-> a1-1 x) (-> v1-0 x-pos)))
                      (f2-1 (- (-> a1-1 z) (-> v1-0 z-pos)))
                      )
                  (set! a0-1 #f)
                  (let ((f1-5 (+ (* f0-4 (-> v1-0 cos-angle)) (* f2-1 (-> v1-0 sin-angle))))
                        (f0-6 (- (* f2-1 (-> v1-0 cos-angle)) (* f0-4 (-> v1-0 sin-angle))))
                        )
                    (if (and (>= f1-5 0.0) (>= f0-6 0.0) (< f1-5 (-> v1-0 x-length)) (< f0-6 (-> v1-0 z-length)))
                        (set! a0-1 #t)
                        )
                    )
                  )
                a0-1
                )
              )
        )
      (if a0-1
          (set! s2-0 (the-as uint #x8000ff00))
          )
      (set! (-> s5-0 y) (-> arg1 height-level))
      (set! (-> s4-0 y) (-> arg1 height-level))
      (set! (-> s5-0 w) 1.0)
      (set! (-> s4-0 w) 1.0)
      (set! (-> s5-0 x) (-> arg1 x-pos))
      (set! (-> s5-0 z) (-> arg1 z-pos))
      (set! (-> s4-0 x) (+ (-> arg1 x-pos) (* (-> arg1 cos-angle) (-> arg1 x-length))))
      (set! (-> s4-0 z) (+ (-> arg1 z-pos) (* (-> arg1 sin-angle) (-> arg1 x-length))))
      (add-debug-line #t arg0 s5-0 s4-0 (the-as rgba s2-0) #f (the-as rgba -1))
      (set! (-> s5-0 quad) (-> s4-0 quad))
      (set! (-> s4-0 x) (+ (-> s5-0 x) (* (- (-> arg1 sin-angle)) (-> arg1 z-length))))
      (set! (-> s4-0 z) (+ (-> s5-0 z) (* (-> arg1 cos-angle) (-> arg1 z-length))))
      (add-debug-line #t arg0 s5-0 s4-0 (the-as rgba s2-0) #f (the-as rgba -1))
      (set! (-> s5-0 x) (+ (-> arg1 x-pos) (* (- (-> arg1 sin-angle)) (-> arg1 z-length))))
      (set! (-> s5-0 z) (+ (-> arg1 z-pos) (* (-> arg1 cos-angle) (-> arg1 z-length))))
      (add-debug-line #t arg0 s5-0 s4-0 (the-as rgba s2-0) #f (the-as rgba -1))
      (set! (-> s4-0 x) (-> arg1 x-pos))
      (set! (-> s4-0 z) (-> arg1 z-pos))
      (add-debug-line #t arg0 s5-0 s4-0 (the-as rgba s2-0) #f (the-as rgba -1))
      )
    )
  )

;;-*-OpenGOAL-End-*-

;; .endfunction

L36:
    .word 0x0
    .word 0x0
L37:
    .word 0x3f800000
L38:
    .word 0x8000ff00
    .word 0x0
L39:
    .word 0x800000ff
    .word 0x0

;------------------------------------------
;  main segment
;------------------------------------------

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; .function points-in-air?
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  ;stack: total 0x00, fp? 0 ra? 0 ep? 1
;;  v1-0: int                         a0-0: vector                      a1-0: vector                     
;;  a2-0: (inline-array air-box)      a3-0: int                         t0-1: air-box                    
;;  t1-3: symbol                      t1-4: symbol                      t2-0: air-box                    
;;  f0-0: float                       f0-4: float                       f0-6: float                      
;;  f1-6: float                       f2-0: float                       f2-2: float                      
;;  f2-5: float                       f3-3: float                       f4-0: float                      
B0:
L1:
    addiu v1, r0, 0           ;; [  0] (set! v1-0 0) [] -> [v1: <integer 0> ]
    beq r0, r0, L16           ;; [  1] (b! #t L16 (nop!)) [] -> []
    sll r0, r0, 0

B1:
L2:
    dsll t0, v1, 5            ;; [  2] (set! t0-0 (sll v1-0 5)) [v1: int ] -> [t0: <value x 32> ]
    daddu t0, a2, t0          ;; [  3] (set! t0-1 (+ arg2 t0-0))
                              ;; [a2: (inline-array air-box) t0: <value x 32> ] -> [t0: air-box ]
    lwc1 f0, 4(t0)            ;; [  4] (set! f0-0 (l.f (+ t0-1 4))) [t0: air-box ] -> []
    lwc1 f1, 4(a0)            ;; [  5] (set! f1-0 (l.f (+ arg0 4))) [a0: vector ] -> []
    c.lt.s f0, f1             ;; [  6] (b! (<.s f0-0 f1-0) L3 (set! t1-0 #t)) [] -> [t1: symbol ]
    bc1t L3
    daddiu t1, s7, 8

B2:
    or t1, s7, r0             ;; [  7] (set! t1-0 #f) [] -> [t1: '#f ]
B3:
L3:
    beql s7, t1, L4           ;; [  8] (bl! (not t1-0) L4 (no-delay!)) [t1: symbol ] -> []
B4:
    or t1, t1, r0             ;; [  9] (set! t1-1 t1-0) [t1: symbol ] -> [t1: symbol ]

B5:
    lwc1 f1, 4(a1)            ;; [ 10] (set! f1-1 (l.f (+ arg1 4))) [a1: vector ] -> []
    c.lt.s f0, f1             ;; [ 11] (b! (<.s f0-0 f1-1) L4 (set! t1-1 #t)) [] -> [t1: symbol ]
    bc1t L4
    daddiu t1, s7, 8

B6:
    or t1, s7, r0             ;; [ 12] (set! t1-1 #f) [] -> [t1: '#f ]
B7:
L4:
    beq s7, t1, L15           ;; [ 13] (b! (not t1-1) L15 (set! t1-2 #f)) [t1: symbol ] -> [t1: '#f ]
    or t1, s7, r0

B8:
    lwc1 f0, 0(a0)            ;; [ 14] (set! f0-1 (l.f arg0)) [a0: vector ] -> []
    lwc1 f1, 0(t0)            ;; [ 15] (set! f1-2 (l.f t0-1)) [t0: air-box ] -> []
    sub.s f2, f0, f1          ;; [ 16] (set! f2-0 (-.s f0-1 f1-2)) [] -> []
    lwc1 f0, 8(a0)            ;; [ 17] (set! f0-2 (l.f (+ arg0 8))) [a0: vector ] -> []
    lwc1 f1, 8(t0)            ;; [ 18] (set! f1-3 (l.f (+ t0-1 8))) [t0: air-box ] -> []
    sub.s f4, f0, f1          ;; [ 19] (set! f4-0 (-.s f0-2 f1-3)) [] -> []
    lwc1 f0, 0(a1)            ;; [ 20] (set! f0-3 (l.f arg1)) [a1: vector ] -> []
    lwc1 f1, 0(t0)            ;; [ 21] (set! f1-4 (l.f t0-1)) [t0: air-box ] -> []
    sub.s f0, f0, f1          ;; [ 22] (set! f0-4 (-.s f0-3 f1-4)) [] -> []
    lwc1 f1, 8(a1)            ;; [ 23] (set! f1-5 (l.f (+ arg1 8))) [a1: vector ] -> []
    lwc1 f3, 8(t0)            ;; [ 24] (set! f3-0 (l.f (+ t0-1 8))) [t0: air-box ] -> []
    sub.s f1, f1, f3          ;; [ 25] (set! f1-6 (-.s f1-5 f3-0)) [] -> []
    or t2, t0, r0             ;; [ 26] (set! t2-0 t0-1) [t0: air-box ] -> [t2: air-box ]
    or t1, s7, r0             ;; [ 27] (set! t1-3 #f) [] -> [t1: '#f ]
    lwc1 f3, 12(t2)           ;; [ 28] (set! f3-1 (l.f (+ t2-0 12))) [t2: air-box ] -> []
    mul.s f3, f2, f3          ;; [ 29] (set! f3-2 (*.s f2-0 f3-1)) [] -> []
    lwc1 f5, 28(t2)           ;; [ 30] (set! f5-0 (l.f (+ t2-0 28))) [t2: air-box ] -> []
    mul.s f5, f4, f5          ;; [ 31] (set! f5-1 (*.s f4-0 f5-0)) [] -> []
    add.s f3, f3, f5          ;; [ 32] (set! f3-3 (+.s f3-2 f5-1)) [] -> []
    lwc1 f5, 12(t2)           ;; [ 33] (set! f5-2 (l.f (+ t2-0 12))) [t2: air-box ] -> []
    mul.s f4, f4, f5          ;; [ 34] (set! f4-1 (*.s f4-0 f5-2)) [] -> []
    lwc1 f5, 28(t2)           ;; [ 35] (set! f5-3 (l.f (+ t2-0 28))) [t2: air-box ] -> []
    mul.s f2, f2, f5          ;; [ 36] (set! f2-1 (*.s f2-0 f5-3)) [] -> []
    sub.s f2, f4, f2          ;; [ 37] (set! f2-2 (-.s f4-1 f2-1)) [] -> []
    mtc1 f4, r0               ;; [ 38] (set! f4-2 0) [] -> []
    c.lt.s f3, f4             ;; [ 39] (b! (>=.s f3-3 f4-2) L5 (set! t3-0 #t)) [] -> [t3: symbol ]
    bc1f L5
    daddiu t3, s7, 8

B9:
    or t3, s7, r0             ;; [ 40] (set! t3-0 #f) [] -> [t3: '#f ]
B10:
L5:
    beql s7, t3, L8           ;; [ 41] (bl! (not t3-0) L8 (no-delay!)) [t3: symbol ] -> []
B11:
    or t2, t3, r0             ;; [ 42] (set! t2-1 t3-0) [t3: symbol ] -> [t2: symbol ]

B12:
    mtc1 f4, r0               ;; [ 43] (set! f4-3 0) [] -> []
    c.lt.s f2, f4             ;; [ 44] (b! (>=.s f2-2 f4-3) L6 (set! t3-1 #t)) [] -> [t3: symbol ]
    bc1f L6
    daddiu t3, s7, 8

B13:
    or t3, s7, r0             ;; [ 45] (set! t3-1 #f) [] -> [t3: '#f ]
B14:
L6:
    beql s7, t3, L8           ;; [ 46] (bl! (not t3-1) L8 (no-delay!)) [t3: symbol ] -> []
B15:
    or t2, t3, r0             ;; [ 47] (set! t2-1 t3-1) [t3: symbol ] -> [t2: symbol ]

B16:
    lwc1 f4, 16(t2)           ;; [ 48] (set! f4-4 (l.f (+ t2-0 16))) [t2: air-box ] -> []
    c.lt.s f3, f4             ;; [ 49] (b! (<.s f3-3 f4-4) L7 (set! t3-2 #t)) [] -> [t3: symbol ]
    bc1t L7
    daddiu t3, s7, 8

B17:
    or t3, s7, r0             ;; [ 50] (set! t3-2 #f) [] -> [t3: '#f ]
B18:
L7:
    beql s7, t3, L8           ;; [ 51] (bl! (not t3-2) L8 (no-delay!)) [t3: symbol ] -> []
B19:
    or t2, t3, r0             ;; [ 52] (set! t2-1 t3-2) [t3: symbol ] -> [t2: symbol ]

B20:
    lwc1 f3, 24(t2)           ;; [ 53] (set! f3-4 (l.f (+ t2-0 24))) [t2: air-box ] -> []
    c.lt.s f2, f3             ;; [ 54] (b! (<.s f2-2 f3-4) L8 (set! t2-1 #t)) [] -> [t2: symbol ]
    bc1t L8
    daddiu t2, s7, 8

B21:
    or t2, s7, r0             ;; [ 55] (set! t2-1 #f) [] -> [t2: '#f ]
B22:
L8:
    beq s7, t2, L9            ;; [ 56] (b! (not t2-1) L9 (set! t2-2 #f)) [t2: symbol ] -> [t2: '#f ]
    or t2, s7, r0

B23:
    daddiu t1, s7, #t         ;; [ 57] (set! t1-3 #t) [] -> [t1: symbol ]
    or t2, t1, r0             ;; [ 58] (set! t2-3 t1-3) [t1: symbol ] -> [t2: symbol ]
B24:
L9:
    beql s7, t1, L14          ;; [ 59] (bl! (not t1-3) L14 (no-delay!)) [t1: symbol ] -> []
B25:
    or t1, t1, r0             ;; [ 60] (set! t1-4 t1-3) [t1: symbol ] -> [t1: symbol ]

B26:
    or t1, s7, r0             ;; [ 61] (set! t1-4 #f) [] -> [t1: '#f ]
    lwc1 f2, 12(t0)           ;; [ 62] (set! f2-3 (l.f (+ t0-1 12))) [t0: air-box ] -> []
    mul.s f2, f0, f2          ;; [ 63] (set! f2-4 (*.s f0-4 f2-3)) [] -> []
    lwc1 f3, 28(t0)           ;; [ 64] (set! f3-5 (l.f (+ t0-1 28))) [t0: air-box ] -> []
    mul.s f3, f1, f3          ;; [ 65] (set! f3-6 (*.s f1-6 f3-5)) [] -> []
    add.s f2, f2, f3          ;; [ 66] (set! f2-5 (+.s f2-4 f3-6)) [] -> []
    lwc1 f3, 12(t0)           ;; [ 67] (set! f3-7 (l.f (+ t0-1 12))) [t0: air-box ] -> []
    mul.s f1, f1, f3          ;; [ 68] (set! f1-7 (*.s f1-6 f3-7)) [] -> []
    lwc1 f3, 28(t0)           ;; [ 69] (set! f3-8 (l.f (+ t0-1 28))) [t0: air-box ] -> []
    mul.s f0, f0, f3          ;; [ 70] (set! f0-5 (*.s f0-4 f3-8)) [] -> []
    sub.s f0, f1, f0          ;; [ 71] (set! f0-6 (-.s f1-7 f0-5)) [] -> []
    mtc1 f1, r0               ;; [ 72] (set! f1-8 0) [] -> []
    c.lt.s f2, f1             ;; [ 73] (b! (>=.s f2-5 f1-8) L10 (set! t2-4 #t)) [] -> [t2: symbol ]
    bc1f L10
    daddiu t2, s7, 8

B27:
    or t2, s7, r0             ;; [ 74] (set! t2-4 #f) [] -> [t2: '#f ]
B28:
L10:
    beql s7, t2, L13          ;; [ 75] (bl! (not t2-4) L13 (no-delay!)) [t2: symbol ] -> []
B29:
    or t0, t2, r0             ;; [ 76] (set! t0-2 t2-4) [t2: symbol ] -> [t0: symbol ]

B30:
    mtc1 f1, r0               ;; [ 77] (set! f1-9 0) [] -> []
    c.lt.s f0, f1             ;; [ 78] (b! (>=.s f0-6 f1-9) L11 (set! t2-5 #t)) [] -> [t2: symbol ]
    bc1f L11
    daddiu t2, s7, 8

B31:
    or t2, s7, r0             ;; [ 79] (set! t2-5 #f) [] -> [t2: '#f ]
B32:
L11:
    beql s7, t2, L13          ;; [ 80] (bl! (not t2-5) L13 (no-delay!)) [t2: symbol ] -> []
B33:
    or t0, t2, r0             ;; [ 81] (set! t0-2 t2-5) [t2: symbol ] -> [t0: symbol ]

B34:
    lwc1 f1, 16(t0)           ;; [ 82] (set! f1-10 (l.f (+ t0-1 16))) [t0: air-box ] -> []
    c.lt.s f2, f1             ;; [ 83] (b! (<.s f2-5 f1-10) L12 (set! t2-6 #t)) [] -> [t2: symbol ]
    bc1t L12
    daddiu t2, s7, 8

B35:
    or t2, s7, r0             ;; [ 84] (set! t2-6 #f) [] -> [t2: '#f ]
B36:
L12:
    beql s7, t2, L13          ;; [ 85] (bl! (not t2-6) L13 (no-delay!)) [t2: symbol ] -> []
B37:
    or t0, t2, r0             ;; [ 86] (set! t0-2 t2-6) [t2: symbol ] -> [t0: symbol ]

B38:
    lwc1 f1, 24(t0)           ;; [ 87] (set! f1-11 (l.f (+ t0-1 24))) [t0: air-box ] -> []
    c.lt.s f0, f1             ;; [ 88] (b! (<.s f0-6 f1-11) L13 (set! t0-2 #t)) [] -> [t0: symbol ]
    bc1t L13
    daddiu t0, s7, 8

B39:
    or t0, s7, r0             ;; [ 89] (set! t0-2 #f) [] -> [t0: '#f ]
B40:
L13:
    beq s7, t0, L14           ;; [ 90] (b! (not t0-2) L14 (set! t0-3 #f)) [t0: symbol ] -> [t0: '#f ]
    or t0, s7, r0

B41:
    daddiu t1, s7, #t         ;; [ 91] (set! t1-4 #t) [] -> [t1: symbol ]
    or t0, t1, r0             ;; [ 92] (set! t0-4 t1-4) [t1: symbol ] -> [t0: symbol ]
B42:
L14:
    beq s7, t1, L15           ;; [ 93] (b! (not t1-4) L15 (set! t1-5 #f)) [t1: symbol ] -> [t1: '#f ]
    or t1, s7, r0

B43:
    daddiu v1, s7, #t         ;; [ 94] (set! v1-1 #t) [] -> [v1: symbol ]
    or v0, v1, r0             ;; [ 95] (set! v0-0 v1-1) [v1: symbol ] -> [v0: symbol ]
    beq r0, r0, L17           ;; [ 96] (b! #t L17 (nop!)) [] -> []
    sll r0, r0, 0

B44:
    or v1, r0, r0             ;; [ 97] (set! v1-0 0) [] -> [v1: <uninitialized> ]
B45:
L15:
    daddiu v1, v1, 1          ;; [ 98] (set! v1-0 (+ v1-0 1)) [v1: int ] -> [v1: <integer 1 + int> ]
B46:
L16:
    slt t0, v1, a3            ;; [ 99] (b! (<.si v1-0 arg3) L2 (nop!)) [v1: int a3: int ] -> []
    bne t0, r0, L2
    sll r0, r0, 0

B47:
    or v1, s7, r0             ;; [100] (set! v1-2 #f) [] -> [v1: '#f ]
    or v1, s7, r0             ;; [101] (set! v1-3 #f) [] -> [v1: '#f ]
    or v0, s7, r0             ;; [102] (set! v0-0 #f) [] -> [v0: '#f ]
B48:
L17:
    jr ra
    daddu sp, sp, r0

    sll r0, r0, 0
    sll r0, r0, 0


;;-*-OpenGOAL-Start-*-
defun
(defun points-in-air? ((arg0 vector) (arg1 vector) (arg2 (inline-array air-box)) (arg3 int))
  (local-vars (t1-4 symbol))
  (dotimes (v1-0 arg3)
    (let* ((t0-1 (-> arg2 v1-0))
           (f0-0 (-> t0-1 height-level))
           )
      (when (and (< f0-0 (-> arg0 y)) (< f0-0 (-> arg1 y)))
        (let ((f2-0 (- (-> arg0 x) (-> t0-1 x-pos)))
              (f4-0 (- (-> arg0 z) (-> t0-1 z-pos)))
              (f0-4 (- (-> arg1 x) (-> t0-1 x-pos)))
              (f1-6 (- (-> arg1 z) (-> t0-1 z-pos)))
              (t2-0 t0-1)
              (t1-3 #f)
              )
          (let ((f3-3 (+ (* f2-0 (-> t2-0 cos-angle)) (* f4-0 (-> t2-0 sin-angle))))
                (f2-2 (- (* f4-0 (-> t2-0 cos-angle)) (* f2-0 (-> t2-0 sin-angle))))
                )
            (if (and (>= f3-3 0.0) (>= f2-2 0.0) (< f3-3 (-> t2-0 x-length)) (< f2-2 (-> t2-0 z-length)))
                (set! t1-3 #t)
                )
            )
          (set! t1-4
                (and t1-3 (begin
                            (set! t1-4 #f)
                            (let ((f2-5 (+ (* f0-4 (-> t0-1 cos-angle)) (* f1-6 (-> t0-1 sin-angle))))
                                  (f0-6 (- (* f1-6 (-> t0-1 cos-angle)) (* f0-4 (-> t0-1 sin-angle))))
                                  )
                              (if (and (>= f2-5 0.0) (>= f0-6 0.0) (< f2-5 (-> t0-1 x-length)) (< f0-6 (-> t0-1 z-length)))
                                  (set! t1-4 #t)
                                  )
                              )
                            t1-4
                            )
                     )
                )
          )
        (if t1-4
            (return #t)
            )
        )
      )
    )
  #f
  )

;;-*-OpenGOAL-End-*-

;; .endfunction

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; .function point-in-air?
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  ;stack: total 0x00, fp? 0 ra? 0 ep? 1
;;  v1-0: int                         a0-0: vector                      a1-0: (inline-array air-box)     
;;  a2-0: int                         a3-1: air-box                     t0-0: symbol                     
;;  t1-0: vector                      f0-2: float                       f0-4: float                      
;;  f1-5: float                       f2-1: float                      
B0:
L18:
    addiu v1, r0, 0           ;; [  0] (set! v1-0 0) [] -> [v1: <integer 0> ]
    beq r0, r0, L26           ;; [  1] (b! #t L26 (nop!)) [] -> []
    sll r0, r0, 0

B1:
L19:
    or t1, a0, r0             ;; [  2] (set! t1-0 arg0) [a0: vector ] -> [t1: vector ]
    dsll a3, v1, 5            ;; [  3] (set! a3-0 (sll v1-0 5)) [v1: int ] -> [a3: <value x 32> ]
    daddu a3, a1, a3          ;; [  4] (set! a3-1 (+ arg1 a3-0))
                              ;; [a1: (inline-array air-box) a3: <value x 32> ] -> [a3: air-box ]
    lwc1 f0, 4(a3)            ;; [  5] (set! f0-0 (l.f (+ a3-1 4))) [a3: air-box ] -> []
    lwc1 f1, 4(t1)            ;; [  6] (set! f1-0 (l.f (+ t1-0 4))) [t1: vector ] -> []
    c.lt.s f0, f1             ;; [  7] (b! (>=.s f0-0 f1-0) L24 (set! t0-0 #f)) [] -> [t0: '#f ]
    bc1f L24
    or t0, s7, r0

B2:
    lwc1 f0, 0(t1)            ;; [  8] (set! f0-1 (l.f t1-0)) [t1: vector ] -> []
    lwc1 f1, 0(a3)            ;; [  9] (set! f1-1 (l.f a3-1)) [a3: air-box ] -> []
    sub.s f0, f0, f1          ;; [ 10] (set! f0-2 (-.s f0-1 f1-1)) [] -> []
    lwc1 f1, 8(t1)            ;; [ 11] (set! f1-2 (l.f (+ t1-0 8))) [t1: vector ] -> []
    lwc1 f2, 8(a3)            ;; [ 12] (set! f2-0 (l.f (+ a3-1 8))) [a3: air-box ] -> []
    sub.s f2, f1, f2          ;; [ 13] (set! f2-1 (-.s f1-2 f2-0)) [] -> []
    or t0, s7, r0             ;; [ 14] (set! t0-0 #f) [] -> [t0: '#f ]
    lwc1 f1, 12(a3)           ;; [ 15] (set! f1-3 (l.f (+ a3-1 12))) [a3: air-box ] -> []
    mul.s f1, f0, f1          ;; [ 16] (set! f1-4 (*.s f0-2 f1-3)) [] -> []
    lwc1 f3, 28(a3)           ;; [ 17] (set! f3-0 (l.f (+ a3-1 28))) [a3: air-box ] -> []
    mul.s f3, f2, f3          ;; [ 18] (set! f3-1 (*.s f2-1 f3-0)) [] -> []
    add.s f1, f1, f3          ;; [ 19] (set! f1-5 (+.s f1-4 f3-1)) [] -> []
    lwc1 f3, 12(a3)           ;; [ 20] (set! f3-2 (l.f (+ a3-1 12))) [a3: air-box ] -> []
    mul.s f2, f2, f3          ;; [ 21] (set! f2-2 (*.s f2-1 f3-2)) [] -> []
    lwc1 f3, 28(a3)           ;; [ 22] (set! f3-3 (l.f (+ a3-1 28))) [a3: air-box ] -> []
    mul.s f0, f0, f3          ;; [ 23] (set! f0-3 (*.s f0-2 f3-3)) [] -> []
    sub.s f0, f2, f0          ;; [ 24] (set! f0-4 (-.s f2-2 f0-3)) [] -> []
    mtc1 f2, r0               ;; [ 25] (set! f2-3 0) [] -> []
    c.lt.s f1, f2             ;; [ 26] (b! (>=.s f1-5 f2-3) L20 (set! t1-1 #t)) [] -> [t1: symbol ]
    bc1f L20
    daddiu t1, s7, 8

B3:
    or t1, s7, r0             ;; [ 27] (set! t1-1 #f) [] -> [t1: '#f ]
B4:
L20:
    beql s7, t1, L23          ;; [ 28] (bl! (not t1-1) L23 (no-delay!)) [t1: symbol ] -> []
B5:
    or a3, t1, r0             ;; [ 29] (set! a3-2 t1-1) [t1: symbol ] -> [a3: symbol ]

B6:
    mtc1 f2, r0               ;; [ 30] (set! f2-4 0) [] -> []
    c.lt.s f0, f2             ;; [ 31] (b! (>=.s f0-4 f2-4) L21 (set! t1-2 #t)) [] -> [t1: symbol ]
    bc1f L21
    daddiu t1, s7, 8

B7:
    or t1, s7, r0             ;; [ 32] (set! t1-2 #f) [] -> [t1: '#f ]
B8:
L21:
    beql s7, t1, L23          ;; [ 33] (bl! (not t1-2) L23 (no-delay!)) [t1: symbol ] -> []
B9:
    or a3, t1, r0             ;; [ 34] (set! a3-2 t1-2) [t1: symbol ] -> [a3: symbol ]

B10:
    lwc1 f2, 16(a3)           ;; [ 35] (set! f2-5 (l.f (+ a3-1 16))) [a3: air-box ] -> []
    c.lt.s f1, f2             ;; [ 36] (b! (<.s f1-5 f2-5) L22 (set! t1-3 #t)) [] -> [t1: symbol ]
    bc1t L22
    daddiu t1, s7, 8

B11:
    or t1, s7, r0             ;; [ 37] (set! t1-3 #f) [] -> [t1: '#f ]
B12:
L22:
    beql s7, t1, L23          ;; [ 38] (bl! (not t1-3) L23 (no-delay!)) [t1: symbol ] -> []
B13:
    or a3, t1, r0             ;; [ 39] (set! a3-2 t1-3) [t1: symbol ] -> [a3: symbol ]

B14:
    lwc1 f1, 24(a3)           ;; [ 40] (set! f1-6 (l.f (+ a3-1 24))) [a3: air-box ] -> []
    c.lt.s f0, f1             ;; [ 41] (b! (<.s f0-4 f1-6) L23 (set! a3-2 #t)) [] -> [a3: symbol ]
    bc1t L23
    daddiu a3, s7, 8

B15:
    or a3, s7, r0             ;; [ 42] (set! a3-2 #f) [] -> [a3: '#f ]
B16:
L23:
    beq s7, a3, L24           ;; [ 43] (b! (not a3-2) L24 (set! a3-3 #f)) [a3: symbol ] -> [a3: '#f ]
    or a3, s7, r0

B17:
    daddiu t0, s7, #t         ;; [ 44] (set! t0-0 #t) [] -> [t0: symbol ]
    or a3, t0, r0             ;; [ 45] (set! a3-4 t0-0) [t0: symbol ] -> [a3: symbol ]
B18:
L24:
    beq s7, t0, L25           ;; [ 46] (b! (not t0-0) L25 (set! a3-5 #f)) [t0: symbol ] -> [a3: '#f ]
    or a3, s7, r0

B19:
    daddiu v1, s7, #t         ;; [ 47] (set! v1-1 #t) [] -> [v1: symbol ]
    or v0, v1, r0             ;; [ 48] (set! v0-0 v1-1) [v1: symbol ] -> [v0: symbol ]
    beq r0, r0, L27           ;; [ 49] (b! #t L27 (nop!)) [] -> []
    sll r0, r0, 0

B20:
    or v1, r0, r0             ;; [ 50] (set! v1-0 0) [] -> [v1: <uninitialized> ]
B21:
L25:
    daddiu v1, v1, 1          ;; [ 51] (set! v1-0 (+ v1-0 1)) [v1: int ] -> [v1: <integer 1 + int> ]
B22:
L26:
    slt a3, v1, a2            ;; [ 52] (b! (<.si v1-0 arg2) L19 (nop!)) [v1: int a2: int ] -> []
    bne a3, r0, L19
    sll r0, r0, 0

B23:
    or v1, s7, r0             ;; [ 53] (set! v1-2 #f) [] -> [v1: '#f ]
    or v1, s7, r0             ;; [ 54] (set! v1-3 #f) [] -> [v1: '#f ]
    or v0, s7, r0             ;; [ 55] (set! v0-0 #f) [] -> [v0: '#f ]
B24:
L27:
    jr ra
    daddu sp, sp, r0



;;-*-OpenGOAL-Start-*-

(defun point-in-air? ((arg0 vector) (arg1 (inline-array air-box)) (arg2 int))
  (local-vars (t0-0 symbol))
  (dotimes (v1-0 arg2)
    (let ((t1-0 arg0)
          (a3-1 (-> arg1 v1-0))
          )
      (set! t0-0
            (when (< (-> a3-1 height-level) (-> t1-0 y))
              (let ((f0-2 (- (-> t1-0 x) (-> a3-1 x-pos)))
                    (f2-1 (- (-> t1-0 z) (-> a3-1 z-pos)))
                    )
                (set! t0-0 #f)
                (let ((f1-5 (+ (* f0-2 (-> a3-1 cos-angle)) (* f2-1 (-> a3-1 sin-angle))))
                      (f0-4 (- (* f2-1 (-> a3-1 cos-angle)) (* f0-2 (-> a3-1 sin-angle))))
                      )
                  (if (and (>= f1-5 0.0) (>= f0-4 0.0) (< f1-5 (-> a3-1 x-length)) (< f0-4 (-> a3-1 z-length)))
                      (set! t0-0 #t)
                      )
                  )
                )
              t0-0
              )
            )
      )
    (if t0-0
        (return #t)
        )
    )
  #f
  )

;;-*-OpenGOAL-End-*-

;; .endfunction

L28:
    .word 0x0
    .word 0x0


