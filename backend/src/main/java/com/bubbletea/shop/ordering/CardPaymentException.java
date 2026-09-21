package com.bubbletea.shop.ordering;

/** Deliberately excludes provider responses, request headers and secrets from exception messages. */
public class CardPaymentException extends RuntimeException {
    private final String code;
    private final int status;
    public CardPaymentException(String code, int status) { super(code); this.code = code; this.status = status; }
    public String code() { return code; }
    public int status() { return status; }
}
