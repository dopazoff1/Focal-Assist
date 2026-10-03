package com.focal.api.models;

import java.util.Locale;
import java.util.Set;

public final class UserStatus {
    public static final String ONLINE = "ONLINE";
    public static final String AWAY = "AWAY";
    public static final String WRAPUP = "WRAPUP";
    public static final String BREAK = "BREAK";
    public static final String OFFLINE = "OFFLINE";

    private static final Set<String> ALLOWED = Set.of(ONLINE, AWAY, WRAPUP, BREAK, OFFLINE);

    private UserStatus() {}

    public static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return OFFLINE;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED.contains(normalized)) {
            throw new IllegalArgumentException("Unsupported status: " + value);
        }
        return normalized;
    }

    public static Set<String> allowed() {
        return ALLOWED;
    }
}
