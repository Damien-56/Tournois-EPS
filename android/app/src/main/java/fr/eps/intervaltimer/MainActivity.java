package fr.eps.tournois;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LanSyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
