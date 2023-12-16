package com.dbsync.syncjob;

import java.util.List;

import org.apache.tomcat.util.net.SocketWrapperBase.CompletionState;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Service;

import com.dbsync.data.AddData;
import com.dbsync.data.CompletionStatus;
import com.dbsync.data.MyTable;
import com.dbsync.syncentity.MyTableRepository;

@Service
public class SyncReader {

    @Value("${com.sync.prop.batch-count}")
    private int batchCount;

    @Autowired
    private MyTableRepository myTableRepository;

    @Autowired
    private SyncSender syncSender;

    @Autowired
    private AddData addData;

    public void dbRead() {
        try {
            
            //MyTableRepository myTableRepository = applicationContext.getBean(MyTableRepository.class);
            //myTableRepository.findTopNByCompletionStatus(CompletionStatus.NOT_COMPLETED.getVal(), batchCount);
            List<MyTable> myTables = myTableRepository.findTop2ByCompletionStatus(CompletionStatus.NOT_COMPLETED.getVal());

            for(MyTable myTable: myTables) {
                myTable.setCompletionStatus(CompletionStatus.COMPLETED.getVal());
                System.out.println("Table row: " + myTable);
            }
            //syncSender.sendHttpRequest(myTables);//Uncomment to send HTTP REST request

            myTableRepository.saveAll(myTables);

            addData.addData();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
