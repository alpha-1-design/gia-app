package com.alpha1studio.gia;

import android.content.SharedPreferences;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "GIACredentialVault")
public class GIACredentialVaultPlugin extends Plugin {
    private static final String PREFS = "gia_credential_vault";
    private static final String KEY_ALIAS = "gia_credential_vault_key";
    private static final String SEP = ".";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, 0);
    }

    private SecretKey key() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
            generator.init(256);
            generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + SEP
            + Base64.encodeToString(encrypted, Base64.NO_WRAP);
    }

    private String decrypt(String value) throws Exception {
        String[] parts = value.split("\\.", 2);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid vault entry");
        byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
        byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void get(PluginCall call) {
        String serviceId = call.getString("serviceId");
        if (serviceId == null || serviceId.isEmpty()) {
            call.reject("serviceId is required");
            return;
        }
        String stored = prefs().getString(serviceId, null);
        JSObject result = new JSObject();
        if (stored != null) {
            try {
                result.put("value", decrypt(stored));
                result.put("record", prefs().getString(serviceId + ":metadata", ""));
            } catch (Exception e) {
                call.reject("Credential could not be decrypted", e);
                return;
            }
        }
        call.resolve(result);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String serviceId = call.getString("serviceId");
        String value = call.getString("value");
        String metadata = call.getString("metadata", "");
        if (serviceId == null || serviceId.isEmpty() || value == null || value.isEmpty()) {
            call.reject("serviceId and value are required");
            return;
        }
        try {
            prefs().edit()
                .putString(serviceId, encrypt(value))
                .putString(serviceId + ":metadata", metadata)
                .apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Credential could not be encrypted", e);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String serviceId = call.getString("serviceId");
        if (serviceId == null || serviceId.isEmpty()) {
            call.reject("serviceId is required");
            return;
        }
        prefs().edit().remove(serviceId).remove(serviceId + ":metadata").apply();
        call.resolve();
    }
}
