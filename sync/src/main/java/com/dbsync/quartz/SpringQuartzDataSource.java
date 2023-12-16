package com.dbsync.quartz;

import javax.sql.DataSource;

import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.quartz.QuartzDataSource;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableAutoConfiguration
public class SpringQuartzDataSource {

    // @Bean
    // @QuartzDataSource
    // public DataSource quartzDataSource() {
    //     return DataSourceBuilder.create().build();
    // }
}