package com.dbsync.syncjob;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.dbsync.data.MyTable;

@Service
public class SyncSender {

    @Value("${com.sync.prop.request-url}")
    private String url;

    public void sendHttpRequest(List<MyTable> data) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<List<MyTable>> requestEntity = new HttpEntity<>(data, headers);
            // Make the POST request
            String response = restTemplate.postForObject(url, requestEntity, String.class);

            //ResponseEntity<String> responseEntity = restTemplate.getForEntity(url, String.class);
            System.out.println("Response: " + response);
        } catch(Exception e) {
            e.printStackTrace();
        }
    }
}