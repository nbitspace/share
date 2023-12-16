package com.dbsync.quartz;

import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.dbsync.syncjob.SyncJob;

@Component
public class QuartzSyncJob implements Job {
    @Autowired
    private SyncJob syncJobService;

    public void execute(JobExecutionContext context) throws JobExecutionException {
        syncJobService.startSync();
    }
}
