package com.dbsync.syncreceive;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.dbsync.data.MyTable;

@RestController
@RequestMapping("/api")
public class SyncReceive {
    
    @PostMapping("/receive-sync")
    public ResponseEntity<String> postMethodName(@RequestBody List<MyTable> receivedEntities) {

        
        return ResponseEntity.ok("Data received successfully!");
    }

    @GetMapping("path")
    public String syncFinished(@RequestParam String param) {
        return "";
    }

    
    
}