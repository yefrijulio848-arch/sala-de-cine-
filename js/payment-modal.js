/* ==========================================================================
   Cine Majestad - Pasarela de Pagos Interactiva & Tarjeta 3D Animada
   ========================================================================== */

const PaymentModal = {
  currentTab: "card",
  activeOrder: null,

  init() {
    if (document.querySelector("#paymentModalBackdrop")) return;

    const modalHtml = `
      <div class="payment-modal-backdrop" id="paymentModalBackdrop">
        <div class="payment-modal-card">
          <!-- Loader de Procesamiento -->
          <div class="payment-processing-overlay" id="paymentProcessingOverlay">
            <div class="payment-spinner"></div>
            <h3 style="color: #fff; margin-bottom: 0.4rem;">Procesando Pago Seguro...</h3>
            <p style="color: var(--text-secondary); font-size: 0.88rem;">Conectando con Cine Majestad Payments Gateway</p>
          </div>

          <!-- Encabezado -->
          <div class="payment-modal-header">
            <div>
              <h3 style="color: #fff; margin: 0; font-size: 1.3rem;">💳 Pasarela de Pago Seguro</h3>
              <p style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 0.2rem;">Cine Majestad Multiplex • Transacción Cifrada 256-bit</p>
            </div>
            <button class="modal-close" onclick="PaymentModal.close()">✕</button>
          </div>

          <div class="payment-modal-body">
            <!-- Total a Pagar Destacado -->
            <div style="background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.25); border-radius: var(--radius-sm); padding: 0.9rem 1.2rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <span style="color: var(--text-secondary); font-size: 0.9rem;">Total a Pagar:</span>
              <strong id="modalPaymentTotalAmount" style="color: var(--gold); font-size: 1.5rem;">$0.00</strong>
            </div>

            <!-- Selector de Métodos de Pago -->
            <div class="payment-methods-tabs">
              <button class="pm-tab-btn active" id="pmBtnCard" onclick="PaymentModal.switchMethod('card')">
                <span style="font-size: 1.3rem;">💳</span>
                <span>Tarjeta Crédito / Débito</span>
              </button>
              <button class="pm-tab-btn" id="pmBtnDigital" onclick="PaymentModal.switchMethod('digital')">
                <span style="font-size: 1.3rem;">📱</span>
                <span>PSE / Nequi / Daviplata</span>
              </button>
              <button class="pm-tab-btn" id="pmBtnCash" onclick="PaymentModal.switchMethod('cash')">
                <span style="font-size: 1.3rem;">🎟️</span>
                <span>Efectivo en Taquilla</span>
              </button>
            </div>

            <!-- ===============================================================
                 MÉTODO 1: TARJETA DE CRÉDITO 3D
                 =============================================================== -->
            <div class="payment-pane active" id="paneCard">
              <!-- Escenario 3D de la Tarjeta Plástica -->
              <div class="card-3d-scene">
                <div class="card-3d-inner" id="card3dInner">
                  <!-- Frente -->
                  <div class="card-face card-front">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div class="card-chip"></div>
                      <span class="card-brand-label" id="cardBrandLabel">VISA</span>
                    </div>

                    <div class="card-number-display" id="cardDisplayNumber">
                      •••• •••• •••• ••••
                    </div>

                    <div class="card-meta-row">
                      <div>
                        <span>TITULAR DE LA TARJETA</span>
                        <strong id="cardDisplayName">TU NOMBRE AQUÍ</strong>
                      </div>
                      <div>
                        <span>EXPIRA</span>
                        <strong id="cardDisplayExpiry">MM/AA</strong>
                      </div>
                    </div>
                  </div>

                  <!-- Reverso -->
                  <div class="card-face card-back">
                    <div class="magnetic-strip"></div>
                    <div style="padding: 1rem 1.5rem 0; text-align: right;">
                      <span style="color: var(--text-muted); font-size: 0.7rem; margin-right: 1.5rem;">CÓDIGO DE SEGURIDAD (CVV)</span>
                      <div class="cvv-band" id="cardDisplayCvv">•••</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Formulario de Tarjeta -->
              <form id="formCardPayment" onsubmit="PaymentModal.handleCardSubmit(event)" novalidate>
                <div class="form-group">
                  <label for="inputCardNumber">Número de Tarjeta</label>
                  <input type="text" id="inputCardNumber" class="form-control" placeholder="4532 •••• •••• 4242" maxlength="19" required>
                  <span class="form-error-feedback" id="inputCardNumberError">Número de tarjeta no válido.</span>
                </div>

                <div class="form-group">
                  <label for="inputCardName">Nombre en la Tarjeta</label>
                  <input type="text" id="inputCardName" class="form-control" placeholder="Como aparece en el plástico" required>
                  <span class="form-error-feedback" id="inputCardNameError">Ingrese el nombre del titular.</span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                  <div class="form-group">
                    <label for="inputCardExpiry">Expiración (MM/AA)</label>
                    <input type="text" id="inputCardExpiry" class="form-control" placeholder="12/28" maxlength="5" required>
                    <span class="form-error-feedback" id="inputCardExpiryError">Fecha inválida.</span>
                  </div>
                  <div class="form-group">
                    <label for="inputCardCvv">CVV / CVC</label>
                    <input type="password" id="inputCardCvv" class="form-control" placeholder="123" maxlength="4" required>
                    <span class="form-error-feedback" id="inputCardCvvError">CVV de 3 o 4 dígitos.</span>
                  </div>
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.95rem; font-size: 1rem; margin-top: 0.5rem;">
                  Pagar y Confirmar Butacas 🔒
                </button>
              </form>
            </div>

            <!-- ===============================================================
                 MÉTODO 2: PAGOS DIGITALES (PSE / NEQUI / DAVIPLATA)
                 =============================================================== -->
            <div class="payment-pane" id="paneDigital">
              <div style="display: flex; gap: 0.5rem; margin-bottom: 1.2rem;">
                <button type="button" class="pill-btn active" id="subTabNequi" onclick="PaymentModal.switchDigitalSub('nequi')">Nequi / Daviplata</button>
                <button type="button" class="pill-btn" id="subTabPse" onclick="PaymentModal.switchDigitalSub('pse')">PSE (Bancos)</button>
              </div>

              <!-- Nequi / Daviplata -->
              <div id="digitalNequiBox">
                <div class="digital-qr-box">
                  <!-- QR Simulado SVG -->
                  <svg viewBox="0 0 100 100" width="100%" height="100%">
                    <rect x="5" y="5" width="30" height="30" fill="#20002c" />
                    <rect x="10" y="10" width="20" height="20" fill="#fff" />
                    <rect x="15" y="15" width="10" height="10" fill="#da0081" />
                    <rect x="65" y="5" width="30" height="30" fill="#20002c" />
                    <rect x="70" y="10" width="20" height="20" fill="#fff" />
                    <rect x="75" y="15" width="10" height="10" fill="#da0081" />
                    <rect x="5" y="65" width="30" height="30" fill="#20002c" />
                    <rect x="10" y="70" width="20" height="20" fill="#fff" />
                    <rect x="15" y="75" width="10" height="10" fill="#da0081" />
                    <rect x="42" y="42" width="16" height="16" fill="#da0081" />
                  </svg>
                </div>
                <p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
                  Escanea el código QR con tu App de <strong>Nequi</strong> o <strong>Daviplata</strong>, o ingresa tu número móvil registrado:
                </p>

                <div class="form-group">
                  <label for="nequiPhone">Número de Celular</label>
                  <input type="tel" id="nequiPhone" class="form-control" placeholder="300 123 4567" value="3001234567">
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px dashed var(--border-color); border-radius: var(--radius-sm); padding: 0.8rem; text-align: center; margin-bottom: 1.2rem;">
                  <span style="font-size: 0.8rem; color: var(--text-muted);">Referencia de Pago:</span>
                  <strong style="display: block; color: var(--gold); font-size: 1.1rem; letter-spacing: 1px;" id="digitalRefCode">NQ-847291</strong>
                </div>

                <button type="button" class="btn btn-primary" style="width: 100%; padding: 0.9rem;" onclick="PaymentModal.processDigitalPayment('Nequi / Daviplata')">
                  Confirmar Notificación en el Móvil 📲
                </button>
              </div>

              <!-- PSE -->
              <div id="digitalPseBox" style="display: none;">
                <div class="form-group">
                  <label for="pseBank">Selecciona tu Banco</label>
                  <select id="pseBank" class="form-control">
                    <option value="Bancolombia">Bancolombia</option>
                    <option value="Davivienda">Banco Davivienda</option>
                    <option value="BBVA">BBVA Colombia</option>
                    <option value="Banco de Bogotá">Banco de Bogotá</option>
                    <option value="Scotiabank">Scotiabank Colpatria</option>
                    <option value="Nu">Nu Colombia</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="pseEmail">Correo Electrónico registrado en PSE</label>
                  <input type="email" id="pseEmail" class="form-control" placeholder="usuario@pse.com" value="carlos@cliente.com">
                </div>

                <button type="button" class="btn btn-primary" style="width: 100%; padding: 0.9rem;" onclick="PaymentModal.processDigitalPayment('PSE')">
                  Ir al Portal de Pagos PSE 🏛️
                </button>
              </div>
            </div>

            <!-- ===============================================================
                 MÉTODO 3: EFECTIVO EN TAQUILLA
                 =============================================================== -->
            <div class="payment-pane" id="paneCash">
              <div style="text-align: center; padding: 1rem 0;">
                <span style="font-size: 3rem;">🎟️</span>
                <h4 style="color: #fff; margin-top: 0.5rem; margin-bottom: 0.5rem;">Pago Presencial en Taquilla</h4>
                <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5; max-width: 440px; margin: 0 auto 1.5rem;">
                  Tus butacas quedarán aseguradas. Presenta este código de reserva en el mostrador de Cine Majestad hasta <strong>15 minutos antes</strong> de iniciar la función para abonar en efectivo.
                </p>

                <div style="background: rgba(212, 175, 55, 0.1); border: 2px dashed var(--gold); border-radius: var(--radius-md); padding: 1rem; display: inline-block; min-width: 260px; margin-bottom: 1.5rem;">
                  <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Código de Boletería Taquilla:</span>
                  <div style="font-size: 1.8rem; font-weight: 800; color: #fff; letter-spacing: 2px;" id="cashReservationCode">
                    CMG-TAQ-9912
                  </div>
                </div>

                <button type="button" class="btn btn-primary" style="width: 100%; padding: 0.9rem;" onclick="PaymentModal.processCashBooking()">
                  Confirmar Reserva en Taquilla 🍿
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);
    this.setupCardInputs();
  },

  open(orderData) {
    this.init();
    this.activeOrder = orderData || Storage.getCurrentOrder();

    if (!this.activeOrder || !this.activeOrder.seats || this.activeOrder.seats.length === 0) {
      alert("Por favor selecciona al menos una butaca antes de pagar.");
      return;
    }

    // Calcular total
    const totalEl = document.querySelector("#modalPaymentTotalAmount");
    if (totalEl) {
      totalEl.textContent = `$${(this.activeOrder.total || 0).toFixed(2)}`;
    }

    // Generar códigos aleatorios para PSE / Taquilla
    const rndCode = Math.floor(100000 + Math.random() * 900000);
    const digitalRef = document.querySelector("#digitalRefCode");
    const cashCode = document.querySelector("#cashReservationCode");
    if (digitalRef) digitalRef.textContent = `NQ-${rndCode}`;
    if (cashCode) cashCode.textContent = `CMG-TAQ-${rndCode.toString().substring(0, 4)}`;

    // Restaurar overlay limpio
    const overlay = document.querySelector("#paymentProcessingOverlay");
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.innerHTML = `
        <div class="payment-spinner"></div>
        <h3 style="color: #fff; margin-bottom: 0.4rem;">Procesando Pago Seguro...</h3>
        <p style="color: var(--text-secondary); font-size: 0.88rem;">Conectando con Cine Majestad Payments Gateway</p>
      `;
    }

    const backdrop = document.querySelector("#paymentModalBackdrop");
    if (backdrop) backdrop.classList.add("open");
  },

  close() {
    const backdrop = document.querySelector("#paymentModalBackdrop");
    if (backdrop) backdrop.classList.remove("open");
    const overlay = document.querySelector("#paymentProcessingOverlay");
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.innerHTML = `
        <div class="payment-spinner"></div>
        <h3 style="color: #fff; margin-bottom: 0.4rem;">Procesando Pago Seguro...</h3>
        <p style="color: var(--text-secondary); font-size: 0.88rem;">Conectando con Cine Majestad Payments Gateway</p>
      `;
    }
  },

  switchMethod(method) {
    this.currentTab = method;
    document.querySelectorAll(".pm-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".payment-pane").forEach(p => p.classList.remove("active"));

    if (method === "card") {
      document.querySelector("#pmBtnCard")?.classList.add("active");
      document.querySelector("#paneCard")?.classList.add("active");
    } else if (method === "digital") {
      document.querySelector("#pmBtnDigital")?.classList.add("active");
      document.querySelector("#paneDigital")?.classList.add("active");
    } else if (method === "cash") {
      document.querySelector("#pmBtnCash")?.classList.add("active");
      document.querySelector("#paneCash")?.classList.add("active");
    }
  },

  switchDigitalSub(sub) {
    const btnNequi = document.querySelector("#subTabNequi");
    const btnPse = document.querySelector("#subTabPse");
    const boxNequi = document.querySelector("#digitalNequiBox");
    const boxPse = document.querySelector("#digitalPseBox");

    if (sub === "nequi") {
      btnNequi.classList.add("active");
      btnPse.classList.remove("active");
      boxNequi.style.display = "block";
      boxPse.style.display = "none";
    } else {
      btnPse.classList.add("active");
      btnNequi.classList.remove("active");
      boxPse.style.display = "block";
      boxNequi.style.display = "none";
    }
  },

  setupCardInputs() {
    const numInput = document.querySelector("#inputCardNumber");
    const nameInput = document.querySelector("#inputCardName");
    const expInput = document.querySelector("#inputCardExpiry");
    const cvvInput = document.querySelector("#inputCardCvv");
    const card3dInner = document.querySelector("#card3dInner");

    const displayNum = document.querySelector("#cardDisplayNumber");
    const displayName = document.querySelector("#cardDisplayName");
    const displayExp = document.querySelector("#cardDisplayExpiry");
    const displayCvv = document.querySelector("#cardDisplayCvv");
    const brandLabel = document.querySelector("#cardBrandLabel");

    if (numInput) {
      numInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "").substring(0, 16);
        let formatted = val.match(/.{1,4}/g)?.join(" ") || val;
        e.target.value = formatted;
        displayNum.textContent = formatted || "•••• •••• •••• ••••";

        if (val.startsWith("4")) brandLabel.textContent = "VISA";
        else if (val.startsWith("5")) brandLabel.textContent = "MASTERCARD";
        else if (val.startsWith("3")) brandLabel.textContent = "AMEX";
        else brandLabel.textContent = "CARD";
      });
    }

    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        displayName.textContent = e.target.value.toUpperCase() || "TU NOMBRE AQUÍ";
      });
    }

    if (expInput) {
      expInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "").substring(0, 4);
        if (val.length >= 2) {
          val = val.substring(0, 2) + "/" + val.substring(2);
        }
        e.target.value = val;
        displayExp.textContent = val || "MM/AA";
      });
    }

    if (cvvInput) {
      cvvInput.addEventListener("focus", () => card3dInner?.classList.add("flipped"));
      cvvInput.addEventListener("blur", () => card3dInner?.classList.remove("flipped"));
      cvvInput.addEventListener("input", (e) => {
        displayCvv.textContent = e.target.value ? "•".repeat(e.target.value.length) : "•••";
      });
    }
  },

  // Validación básica formato Luhn
  validateCardNumber(numberStr) {
    const digits = numberStr.replace(/\s+/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  },

  handleCardSubmit(event) {
    event.preventDefault();
    const numInput = document.querySelector("#inputCardNumber");
    const nameInput = document.querySelector("#inputCardName");
    const expInput = document.querySelector("#inputCardExpiry");
    const cvvInput = document.querySelector("#inputCardCvv");

    let isValid = true;

    // Validar Número
    const numClean = numInput.value.replace(/\s+/g, "");
    const isLuhn = this.validateCardNumber(numClean);
    document.querySelector("#inputCardNumberError").classList.toggle("visible", !isLuhn);
    if (!isLuhn) isValid = false;

    // Validar Nombre
    if (nameInput.value.trim().length < 3) {
      document.querySelector("#inputCardNameError").classList.add("visible");
      isValid = false;
    } else {
      document.querySelector("#inputCardNameError").classList.remove("visible");
    }

    // Validar Expiración
    const expRegex = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;
    if (!expRegex.test(expInput.value)) {
      document.querySelector("#inputCardExpiryError").classList.add("visible");
      isValid = false;
    } else {
      document.querySelector("#inputCardExpiryError").classList.remove("visible");
    }

    // Validar CVV
    if (cvvInput.value.length < 3) {
      document.querySelector("#inputCardCvvError").classList.add("visible");
      isValid = false;
    } else {
      document.querySelector("#inputCardCvvError").classList.remove("visible");
    }

    if (!isValid) return;

    const brand = document.querySelector("#cardBrandLabel")?.textContent || "Tarjeta";
    const last4 = numClean.slice(-4);
    this.executePaymentTransaction(`${brand} (•••• ${last4})`);
  },

  processDigitalPayment(serviceName) {
    this.executePaymentTransaction(serviceName);
  },

  processCashBooking() {
    this.executePaymentTransaction("Efectivo en Taquilla (Reserva Pendiente)");
  },

  async executePaymentTransaction(paymentMethodTitle) {
    const overlay = document.querySelector("#paymentProcessingOverlay");
    if (overlay) {
      overlay.innerHTML = `
        <div class="payment-spinner"></div>
        <h3 style="color: #fff; margin-bottom: 0.4rem;">Procesando Pago Seguro...</h3>
        <p style="color: var(--text-secondary); font-size: 0.88rem;">Conectando con Cine Majestad Payments Gateway</p>
      `;
      overlay.classList.add("visible");
    }

    try {
      const user = (typeof Storage !== "undefined" && Storage.getAuthUser) ? Storage.getAuthUser() : null;
      const customerName = user ? `${user.nombre} ${user.apellido || ""}`.trim() : "Cliente Cine Majestad";
      const customerEmail = user ? user.email : "cliente@cinemajestad.com";
      const userId = user ? user.id : null;

      const seatCodes = (this.activeOrder.seats || []).map(s => (typeof s === "string" ? s : (s.code || s)));
      const showtimeKey = this.activeOrder.showtimeKey || `${this.activeOrder.movieId}_${this.activeOrder.showtime}`;

      const bookingPayload = {
        ...this.activeOrder,
        showtimeKey,
        seats: seatCodes,
        userId,
        customerName,
        customerEmail,
        paymentMethod: paymentMethodTitle
      };

      // Simular tiempo de validación bancaria realista (1 segundo)
      await new Promise(resolve => setTimeout(resolve, 1000));

      let finalBooking = null;

      try {
        // Intentar guardar vía API REST en MySQL / Express si el servidor está encendido
        const response = await API.orders.create(bookingPayload);
        finalBooking = response.data || response;
        if (finalBooking && finalBooking.data) finalBooking = finalBooking.data;
        Storage.saveBooking(finalBooking);
      } catch (err) {
        console.warn("[Payment] API fallback local:", err.message);
        finalBooking = Storage.saveBooking(bookingPayload);
      }

      if (!finalBooking) {
        finalBooking = Storage.saveBooking(bookingPayload);
      }

      // Actualizar butacas ocupadas localmente y liberar candados temporales
      const mySessionId = Storage.getSessionId ? Storage.getSessionId() : null;
      if (Storage.releaseAllLocksForSession && mySessionId) {
        Storage.releaseAllLocksForSession(mySessionId, showtimeKey);
      }

      const occupied = Storage.getOccupiedSeats(showtimeKey);
      (finalBooking.seats || []).forEach(s => {
        const code = s.code || s;
        if (!occupied.includes(code)) occupied.push(code);
        if (Storage.unlockSeat) Storage.unlockSeat(showtimeKey, code);
      });
      if (Storage.saveOccupiedSeats) {
        Storage.saveOccupiedSeats(showtimeKey, occupied);
      }

      // Limpiar orden en borrador de la sesión
      sessionStorage.removeItem("cinemajestad_current_order");

      // Notificar a Socket.io si está conectado
      if (typeof RealTime !== "undefined" && RealTime.socket && RealTime.socket.connected) {
        RealTime.socket.emit("seat:booked", {
          showtimeKey,
          seats: finalBooking.seats,
          bookingId: finalBooking.id || finalBooking.bookingCode
        });
      }

      // Feedback visual inmediato de éxito antes de redirigir
      const isCash = paymentMethodTitle.toLowerCase().includes("taquilla") || paymentMethodTitle.toLowerCase().includes("efectivo");
      const successTitle = isCash ? "¡Reserva Confirmada en Taquilla! 🎟️" : "¡Pago Aprobado con Éxito! 🎉";
      const successDesc = isCash 
        ? "Tus butacas han sido apartadas. Generando tu comprobante..."
        : "Transacción aprobada. Generando tu boleto digital...";

      if (overlay) {
        overlay.innerHTML = `
          <div style="font-size: 3.5rem; margin-bottom: 0.6rem;">✅</div>
          <h3 style="color: #00e676; margin-bottom: 0.4rem; font-size: 1.3rem;">${successTitle}</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">${successDesc}</p>
        `;
      }

      // Redirigir al cliente a checkout.html con su entrada generada
      setTimeout(() => {
        const targetId = finalBooking.id || finalBooking.bookingCode || "";
        window.location.href = `checkout.html?bookingId=${targetId}`;
      }, 900);

    } catch (criticalErr) {
      console.error("[Payment] Error en la transacción:", criticalErr);
      if (overlay) {
        overlay.innerHTML = `
          <div style="font-size: 3rem; margin-bottom: 0.6rem;">⚠️</div>
          <h3 style="color: #ff5252; margin-bottom: 0.4rem;">Ocurrió un inconveniente</h3>
          <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 1.2rem;">${criticalErr.message || "No se pudo procesar la transacción."}</p>
          <button class="btn btn-secondary btn-sm" onclick="PaymentModal.close()">Cerrar y Reintentar</button>
        `;
      }
    }
  }
};

window.PaymentModal = PaymentModal;
