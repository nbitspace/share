package com.dbsync.data;

import java.util.Random;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dbsync.syncentity.MyTableRepository;

@Service
public class AddData {
    private final MyTableRepository myTableRepository;

    @Autowired
    public AddData(MyTableRepository myTableRepository) {
        this.myTableRepository = myTableRepository;
    }

    public void addData() {
        int rows = new Random().nextInt(3);
        for (int i = 0; i <= rows; i++) {
            int rec = new Random().nextInt();
            MyTable myTable = new MyTable();
            myTable.setName("Name"+ rec);
            myTable.setEmail("name" + rec + "@email.com");
            myTable.setAge(i + 10);

            myTableRepository.save(myTable);
        }
    }
}
