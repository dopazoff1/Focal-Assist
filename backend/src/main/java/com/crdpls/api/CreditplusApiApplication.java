package com.crdpls.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CreditplusApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(CreditplusApiApplication.class, args);
	}

}
