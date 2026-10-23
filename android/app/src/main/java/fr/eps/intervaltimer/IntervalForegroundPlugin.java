package fr.eps.intervaltimer;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "IntervalForeground")
public class IntervalForegroundPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        Intent intent = new Intent(getContext(), IntervalForegroundService.class)
            .putExtra(IntervalForegroundService.EXTRA_TITLE, call.getString("title", "Intervalle EPS"))
            .putExtra(IntervalForegroundService.EXTRA_INTERVAL, call.getString("interval", "Séance EPS"))
            .putExtra(IntervalForegroundService.EXTRA_REMAINING, call.getInt("remainingSeconds", 0));
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) { update(call); }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), IntervalForegroundService.class));
        call.resolve();
    }
}
