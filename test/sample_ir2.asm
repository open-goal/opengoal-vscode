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
